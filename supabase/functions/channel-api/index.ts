import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { Buffer } from 'node:buffer';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-twitch-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY') || '';
const ADDRESS_SECRET = Deno.env.get('ADDRESS_ENCRYPTION_SECRET') || '';
const CORE_MODS = new Set((Deno.env.get('CORE_MODS') || 'marved,bazzteedj,bazztee,flashmobnbg,ga_wo,zusaki,itzda_venom')
  .split(',').map(value => value.trim().toLowerCase()).filter(Boolean));

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
// Firebase service account JSON (Projekteinstellungen > Dienstkonten). Without it, push is simply skipped.
const FCM_SERVICE_ACCOUNT = Deno.env.get('FCM_SERVICE_ACCOUNT') || '';
const channelTables = new Map([
  ['qna_questions', 'channel'],
  ['stream_setups', 'channel'],
  ['mod_watchlist', 'channel'],
  ['mod_chat', 'channel'],
  ['giveaway_winners', 'channel'],
  ['bestrafungen', 'channel'],
  ['qna_settings', 'channel'],
  ['shisha_sessions', 'channel'],
  ['telegram_config', 'id'],
]);
const globalTables = new Set(['shishawg_catalog', 'poll_templates']);
const allowedOperations = new Set(['select', 'insert', 'upsert', 'update', 'delete']);

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function cleanChannel(value: unknown) {
  return String(value || '').toLowerCase().replace(/^#/, '').trim();
}

async function validateTwitchToken(token: string) {
  if (!token) throw new Error('Twitch-Anmeldung fehlt.');
  const response = await fetch('https://id.twitch.tv/oauth2/validate', {
    headers: { Authorization: `OAuth ${token}` },
  });
  if (!response.ok) throw new Error('Twitch-Anmeldung ist ungültig oder abgelaufen.');
  return await response.json();
}

async function isModerator(token: string, user: any, channel: string) {
  if (!channel) return false;
  const login = cleanChannel(user.login);
  if (login === channel) return true;
  if (channel === 'marved' && CORE_MODS.has(login)) return true;

  let cursor = '';
  do {
    const query = new URLSearchParams({ user_id: String(user.user_id), first: '100' });
    if (cursor) query.set('after', cursor);
    const response = await fetch(`https://api.twitch.tv/helix/moderation/channels?${query}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Client-Id': String(user.client_id || ''),
      },
    });
    if (!response.ok) return false;
    const page = await response.json();
    if ((page.data || []).some((entry: any) => cleanChannel(entry.broadcaster_login) === channel)) return true;
    cursor = page.pagination?.cursor || '';
  } while (cursor);
  return false;
}

function deriveAddressKey() {
  if (!ADDRESS_SECRET) throw new Error('ADDRESS_ENCRYPTION_SECRET ist nicht konfiguriert.');
  return scryptSync(ADDRESS_SECRET, 'shishawg-address-v2-2026', 32);
}

function encryptAddress(address: unknown) {
  if (!address || typeof address !== 'object') return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveAddressKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(address), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v2:${Buffer.concat([iv, tag, encrypted]).toString('base64')}`;
}

function decryptAddress(value: unknown) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  if (!value.startsWith('v2:')) return value;
  try {
    const bytes = Buffer.from(value.slice(3), 'base64');
    const decipher = createDecipheriv('aes-256-gcm', deriveAddressKey(), bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const plain = Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]);
    return JSON.parse(plain.toString('utf8'));
  } catch {
    return null;
  }
}

function applyFilters(query: any, filters: Record<string, unknown> = {}) {
  for (const [column, value] of Object.entries(filters || {})) {
    if (!/^[a-z_][a-z0-9_]*$/i.test(column)) throw new Error('Ungültiger Filter.');
    query = query.eq(column, value);
  }
  return query;
}

async function assertNoCrossChannelIdConflict(table: string, scopeColumn: string | undefined, values: any, channel: string) {
  if (scopeColumn !== 'channel') return;
  const rows = (Array.isArray(values) ? values : [values]).filter(Boolean);
  const ids = [...new Set(rows.map(row => row.id).filter(Boolean))];
  if (ids.length === 0) return;
  const { data, error } = await admin.from(table).select(`id,${scopeColumn}`).in('id', ids);
  if (error) throw error;
  if ((data || []).some((row: any) => cleanChannel(row[scopeColumn]) !== channel)) {
    throw new Error('Eine Datensatz-ID gehört bereits zu einem anderen Kanal.');
  }
}

async function runDatabaseAction(body: any, channel: string) {
  const table = String(body.table || '');
  const operation = String(body.operation || '');
  if (!channelTables.has(table) && !globalTables.has(table)) throw new Error('Tabelle nicht freigegeben.');
  if (!allowedOperations.has(operation)) throw new Error('Operation nicht freigegeben.');

  const scopeColumn = channelTables.get(table);
  let values = body.values;
  if (scopeColumn) {
    if (Array.isArray(values)) values = values.map(row => ({ ...row, [scopeColumn]: channel }));
    else if (values && typeof values === 'object') values = { ...values, [scopeColumn]: channel };
  }
  if (operation === 'insert' || operation === 'upsert') {
    await assertNoCrossChannelIdConflict(table, scopeColumn, values, channel);
  }

  let query: any;
  if (operation === 'select') {
    query = admin.from(table).select(body.select || '*');
  } else if (operation === 'insert') {
    query = admin.from(table).insert(values).select(body.select || '*');
  } else if (operation === 'upsert') {
    query = admin.from(table).upsert(values, body.onConflict ? { onConflict: body.onConflict } : undefined).select(body.select || '*');
  } else if (operation === 'update') {
    query = admin.from(table).update(values).select(body.select || '*');
  } else {
    query = admin.from(table).delete().select(body.select || '*');
  }

  if (scopeColumn && operation !== 'insert' && operation !== 'upsert') query = query.eq(scopeColumn, channel);
  query = applyFilters(query, body.filters || {});
  if (body.order?.column) query = query.order(body.order.column, { ascending: body.order.ascending !== false });
  if (Number.isInteger(body.limit)) query = query.limit(Math.min(Math.max(body.limit, 1), 1000));
  if (body.maybeSingle) query = query.maybeSingle();
  if (body.single) query = query.single();

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function listGiveaways(channel: string) {
  const { data, error } = await admin.from('giveaway_winners').select('*').eq('channel', channel).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row: any) => ({ ...row, address: decryptAddress(row.address) }));
}

async function upsertGiveaway(channel: string, winner: any, createOnly = false) {
  const row = { ...winner, channel };
  await assertNoCrossChannelIdConflict('giveaway_winners', 'channel', row, channel);
  if (row.address && typeof row.address === 'object') row.address = encryptAddress(row.address);
  if (createOnly) {
    // Repeated delivery of the same redemption keeps the existing status, claim and address.
    const { error } = await admin.from('giveaway_winners').upsert(row, { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw error;
    const { data: existing, error: readError } = await admin.from('giveaway_winners')
      .select('*').eq('id', row.id).eq('channel', channel).single();
    if (readError) throw readError;
    return { ...existing, address: decryptAddress(existing.address) };
  }
  const { data, error } = await admin.from('giveaway_winners').upsert(row, { onConflict: 'id' }).select('*').single();
  if (error) throw error;
  return { ...data, address: decryptAddress(data.address) };
}

async function heartbeatPresence(channel: string, twitchUser: any, body: any) {
  const twitchUserId = String(twitchUser.user_id || '').trim();
  const login = cleanChannel(twitchUser.login);
  if (!twitchUserId || !login) throw new Error('Twitch-Nutzer konnte nicht eindeutig erkannt werden.');

  const now = new Date().toISOString();
  const displayName = String(body.displayName || login).trim().slice(0, 80) || login;
  const requestedAvatarUrl = String(body.avatarUrl || '').trim().slice(0, 600);
  const avatarUrl = /^https:\/\//i.test(requestedAvatarUrl) ? requestedAvatarUrl : '';
  const { data, error } = await admin.from('mod_presence').upsert({
    channel,
    twitch_user_id: twitchUserId,
    login,
    display_name: displayName,
    avatar_url: avatarUrl,
    last_seen_at: now,
  }, { onConflict: 'channel,twitch_user_id' }).select('*').single();
  if (error) throw error;
  return data;
}

// Read receipts: store the newest mod-chat message timestamp this mod has seen. Never moves backwards.
async function markChatRead(channel: string, twitchUser: any, body: any) {
  const twitchUserId = String(twitchUser.user_id || '').trim();
  if (!twitchUserId) throw new Error('Twitch-Nutzer konnte nicht eindeutig erkannt werden.');
  const readAtMs = Number(body.readAt);
  if (!Number.isFinite(readAtMs) || readAtMs <= 0) throw new Error('Ungültiger Lesezeitpunkt.');
  const readAt = new Date(Math.min(readAtMs, Date.now() + 5 * 60 * 1000)).toISOString();
  const { error } = await admin.from('mod_presence')
    .update({ chat_read_at: readAt })
    .eq('channel', channel)
    .eq('twitch_user_id', twitchUserId)
    .or(`chat_read_at.is.null,chat_read_at.lt."${readAt}"`);
  if (error) throw error;
  return true;
}

async function listPresence(channel: string) {
  const { data, error } = await admin.from('mod_presence')
    .select('twitch_user_id,login,display_name,avatar_url,first_seen_at,last_seen_at,chat_read_at')
    .eq('channel', channel)
    .order('last_seen_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return data || [];
}

// Direct messages never pass through the generic channel-scoped database action.
// Both participants are derived from a validated Twitch identity or a recorded mod login.
function twitchId(value: unknown) {
  const id = String(value || '').trim();
  if (!/^\d{1,30}$/.test(id)) throw new Error('Ungültige Twitch-Nutzer-ID.');
  return id;
}

async function directMessageRecipient(channel: string, senderId: string, requestedId: unknown) {
  const recipientId = twitchId(requestedId);
  if (recipientId === senderId) throw new Error('Du kannst dir selbst keine Direktnachricht senden.');
  const { data, error } = await admin.from('mod_presence')
    .select('twitch_user_id,login').eq('channel', channel)
    .eq('twitch_user_id', recipientId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Dieser Mod ist für den Kanal noch nicht registriert.');
  return data;
}

async function listDirectMessages(channel: string, user: any, recipientId: unknown) {
  const senderId = twitchId(user.user_id);
  const recipient = await directMessageRecipient(channel, senderId, recipientId);
  const { data, error } = await admin.from('mod_direct_messages')
    .select('id,sender_user_id,recipient_user_id,sender_login,recipient_login,message,created_at')
    .eq('channel', channel)
    .or(`and(sender_user_id.eq.${senderId},recipient_user_id.eq.${recipient.twitch_user_id}),and(sender_user_id.eq.${recipient.twitch_user_id},recipient_user_id.eq.${senderId})`)
    .order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return (data || []).reverse();
}

// Newest private messages addressed to the signed-in mod (all senders), used for notifications.
async function listDirectInbox(channel: string, user: any) {
  const recipientId = twitchId(user.user_id);
  const { data, error } = await admin.from('mod_direct_messages')
    .select('id,sender_user_id,recipient_user_id,sender_login,recipient_login,message,created_at')
    .eq('channel', channel)
    .eq('recipient_user_id', recipientId)
    .order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return (data || []).reverse();
}

async function sendDirectMessage(channel: string, user: any, body: any) {
  const senderId = twitchId(user.user_id);
  const recipient = await directMessageRecipient(channel, senderId, body.recipientId);
  const message = String(body.message || '').trim();
  if (!message || message.length > 1000) throw new Error('Die Nachricht muss 1 bis 1000 Zeichen enthalten.');
  const { data, error } = await admin.from('mod_direct_messages').insert({
    channel,
    sender_user_id: senderId,
    recipient_user_id: recipient.twitch_user_id,
    sender_login: cleanChannel(user.login),
    recipient_login: recipient.login,
    message,
  }).select('id,sender_user_id,recipient_user_id,sender_login,recipient_login,message,created_at').single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Push notifications (Android app via Firebase Cloud Messaging HTTP v1)
// ---------------------------------------------------------------------------
let fcmAccess = { token: '', expiresAt: 0 };

function base64Url(input: Uint8Array | string) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fcmServiceAccount() {
  if (!FCM_SERVICE_ACCOUNT) return null;
  try {
    const account = JSON.parse(FCM_SERVICE_ACCOUNT);
    return account?.client_email && account?.private_key && account?.project_id ? account : null;
  } catch (_) {
    console.error('FCM_SERVICE_ACCOUNT ist kein gültiges JSON.');
    return null;
  }
}

async function fcmAccessToken(account: any) {
  if (fcmAccess.token && Date.now() < fcmAccess.expiresAt - 60_000) return fcmAccess.token;
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64Url(JSON.stringify({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const pem = String(account.private_key).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), char => char.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`)));
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${base64Url(signature)}`,
    }),
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) throw new Error('FCM-Anmeldung fehlgeschlagen: ' + (result.error_description || result.error || response.status));
  fcmAccess = { token: result.access_token, expiresAt: Date.now() + Number(result.expires_in || 3600) * 1000 };
  return fcmAccess.token;
}

function pushToken(value: unknown) {
  const token = String(value || '').trim();
  if (!/^[A-Za-z0-9_:\-]{20,4096}$/.test(token)) throw new Error('Ungültiger Push-Token.');
  return token;
}

async function registerPushDevice(channel: string, twitchUser: any, body: any) {
  const twitchUserId = twitchId(twitchUser.user_id);
  const token = pushToken(body.token);
  // A phone only shows one channel at a time: drop registrations for other channels (or another account).
  const { error: cleanupError } = await admin.from('push_devices').delete().eq('token', token).neq('channel', channel);
  if (cleanupError) throw cleanupError;
  const { error } = await admin.from('push_devices').upsert({
    token,
    channel,
    twitch_user_id: twitchUserId,
    login: cleanChannel(twitchUser.login),
    platform: 'android',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'token,channel' });
  if (error) throw error;
  return true;
}

async function unregisterPushDevice(channel: string, twitchUser: any, body: any) {
  const { error } = await admin.from('push_devices').delete()
    .eq('token', pushToken(body.token)).eq('channel', channel)
    .eq('twitch_user_id', twitchId(twitchUser.user_id));
  if (error) throw error;
  return true;
}

// recipients: 'channel' = every registered mod of the channel except the sender; otherwise one Twitch user id.
async function sendPush(channel: string, senderId: string, recipients: string, title: string, text: string, data: Record<string, string>) {
  const account = fcmServiceAccount();
  if (!account) return;
  let query = admin.from('push_devices').select('token').eq('channel', channel).neq('twitch_user_id', senderId);
  if (recipients !== 'channel') query = query.eq('twitch_user_id', recipients);
  const { data: devices, error } = await query.limit(500);
  if (error || !devices?.length) return;
  const accessToken = await fcmAccessToken(account);
  const body = text.length > 160 ? text.slice(0, 157) + '...' : text;
  await Promise.all(devices.map(async ({ token }) => {
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data: { ...data, channel },
          android: { priority: 'HIGH', notification: { channel_id: 'modchat', tag: data.kind === 'direct' ? `direct-${data.senderId}` : 'modchat' } },
        },
      }),
    });
    if (response.status === 404 || response.status === 400) {
      // UNREGISTERED / INVALID_ARGUMENT: the app was uninstalled or the token rotated.
      await admin.from('push_devices').delete().eq('token', token);
    }
  }));
}

function sendPushInBackground(task: Promise<void>) {
  const guarded = task.catch(error => console.error('Push fehlgeschlagen:', error));
  // Answer the client immediately; the runtime keeps the function alive until the push is out.
  (globalThis as any).EdgeRuntime?.waitUntil?.(guarded);
}

function notifyModChat(channel: string, twitchUser: any, body: any) {
  if (body.table !== 'mod_chat' || (body.operation !== 'upsert' && body.operation !== 'insert')) return;
  const row = Array.isArray(body.values) ? body.values[0] : body.values;
  const createdAt = new Date(row?.created_at || Date.now()).getTime();
  if (!row?.message || Math.abs(Date.now() - createdAt) > 2 * 60 * 1000) return;
  const sender = String(row.sender || twitchUser.login || 'Mod').slice(0, 80);
  sendPushInBackground(sendPush(channel, String(twitchUser.user_id || ''), 'channel',
    `💬 ${sender} im Mod-Chat`, String(row.message), { kind: 'modchat' }));
}

async function submitClaim(body: any, twitchToken: string) {
  const user = await validateTwitchToken(twitchToken);
  const channel = cleanChannel(body.channel);
  const username = cleanChannel(body.username);
  if (!body.id || !channel || !username || cleanChannel(user.login) !== username) {
    throw new Error('Der Twitch-Account passt nicht zu diesem Gewinn.');
  }

  const { data: winner, error: lookupError } = await admin.from('giveaway_winners')
    .select('id,status').eq('id', body.id).eq('username', username).eq('channel', channel).maybeSingle();
  if (lookupError) throw lookupError;
  if (!winner) throw new Error('Der Gewinn wurde nicht gefunden.');
  if (winner.status === 'sent_to_telegram') throw new Error('Die Daten wurden bereits abgesendet.');

  const safeAddress = {
    fullName: String(body.address?.fullName || '').trim().slice(0, 160),
    street: String(body.address?.street || '').trim().slice(0, 200),
    zip: String(body.address?.zip || '').trim().slice(0, 32),
    city: String(body.address?.city || '').trim().slice(0, 120),
    country: String(body.address?.country || '').trim().slice(0, 80),
    coalSize: String(body.address?.coalSize || '').trim().slice(0, 32),
    rewardType: String(body.address?.rewardType || '').trim().slice(0, 40),
    verifiedTwitchLogin: username,
    verifiedTwitchId: String(user.user_id || ''),
    submittedAt: Date.now(),
  };
  if (!safeAddress.fullName || !safeAddress.street || !safeAddress.zip || !safeAddress.city) throw new Error('Die Adresse ist unvollständig.');

  const { data, error } = await admin.from('giveaway_winners').update({
    status: 'address_received',
    address: encryptAddress(safeAddress),
  }).eq('id', body.id).eq('username', username).eq('channel', channel).neq('status', 'sent_to_telegram').select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Die Daten wurden bereits abgesendet.');
  return { id: data.id };
}

// Catalog changes are applied one by one to the current cloud list. Clients never
// upload whole lists, so a stale local copy cannot restore deleted or drop new entries.
const catalogCategories = new Set(['pipes', 'bowls', 'vases', 'hmds', 'charcoal', 'persons', 'tastings', 'promos', 'tobacco']);

function catalogItemName(item: unknown) {
  return String(typeof item === 'string' ? item : (item as any)?.name || '').trim();
}

function cleanCatalogItem(item: unknown) {
  const name = catalogItemName(item).replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 200);
  if (!name) throw new Error('Leerer Katalogeintrag.');
  if (typeof item !== 'object' || item === null) return name;
  const clean: Record<string, unknown> = { name };
  if ((item as any).isElectric === true) clean.isElectric = true;
  if ((item as any).flavor) clean.flavor = String((item as any).flavor).trim().slice(0, 200);
  return Object.keys(clean).length === 1 ? name : clean;
}

function applyCatalogChange(items: unknown[], op: string, item: unknown, newItem?: unknown) {
  const list = Array.isArray(items) ? [...items] : [];
  const key = catalogItemName(item).toLowerCase();
  const indexOf = (k: string) => list.findIndex(entry => catalogItemName(entry).toLowerCase() === k);
  if (op === 'add') {
    if (indexOf(key) === -1) list.push(cleanCatalogItem(item));
  } else if (op === 'remove') {
    return list.filter(entry => catalogItemName(entry).toLowerCase() !== key);
  } else if (op === 'rename') {
    const replacement = cleanCatalogItem(newItem);
    const newKey = catalogItemName(replacement).toLowerCase();
    const rest = list.filter(entry => {
      const k = catalogItemName(entry).toLowerCase();
      return k !== key && k !== newKey;
    });
    rest.push(replacement);
    list.length = 0;
    list.push(...rest);
  } else {
    throw new Error('Unbekannte Katalogänderung.');
  }
  return list.sort((a, b) => catalogItemName(a).localeCompare(catalogItemName(b), 'de'));
}

async function changeCatalog(body: any) {
  const category = String(body.category || '');
  if (!catalogCategories.has(category)) throw new Error('Unbekannte Katalogkategorie.');
  const op = String(body.op || '');
  // Optimistic concurrency: retry when another mod changed the same category meanwhile.
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: row, error } = await admin.from('shishawg_catalog')
      .select('category,items,updated_at').eq('category', category).maybeSingle();
    if (error) throw error;
    const items = applyCatalogChange(row?.items || [], op, body.item, body.newItem);
    const updatedAt = new Date().toISOString();
    if (!row) {
      const { data, error: insertError } = await admin.from('shishawg_catalog')
        .insert({ category, items, updated_at: updatedAt }).select('category,items,updated_at').maybeSingle();
      if (!insertError && data) return data;
      if (insertError && insertError.code !== '23505') throw insertError;
      continue;
    }
    let update = admin.from('shishawg_catalog').update({ items, updated_at: updatedAt }).eq('category', category);
    update = row.updated_at === null ? update.is('updated_at', null) : update.eq('updated_at', row.updated_at);
    const { data, error: updateError } = await update.select('category,items,updated_at').maybeSingle();
    if (updateError) throw updateError;
    if (data) return data;
  }
  throw new Error('Katalog wird gerade von mehreren Mods geändert. Bitte erneut versuchen.');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Serverkonfiguration fehlt.');
    const body = await request.json();
    const twitchToken = request.headers.get('x-twitch-token') || '';

    if (body.action === 'claim.submit') {
      return json(200, { data: await submitClaim(body, twitchToken) });
    }

    const channel = cleanChannel(body.channel);
    const twitchUser = await validateTwitchToken(twitchToken);
    if (!(await isModerator(twitchToken, twitchUser, channel))) return json(403, { error: 'Keine Moderator-Berechtigung für diesen Kanal.' });

    if (body.action === 'catalog.change') {
      if (channel !== 'marved' || !CORE_MODS.has(cleanChannel(twitchUser.login))) {
        return json(403, { error: 'Den Katalog darf nur das ShishaWG-Core-Team ändern.' });
      }
      return json(200, { data: await changeCatalog(body) });
    }
    if (body.action === 'db' && body.table === 'shishawg_catalog' && body.operation !== 'select') {
      // Old app versions upload whole lists and would undo other mods' changes.
      return json(409, { error: 'Bitte das Mod-Tool aktualisieren, um den Katalog zu ändern.' });
    }
    if (body.action === 'db' && globalTables.has(String(body.table || '')) && body.operation !== 'select') {
      const login = cleanChannel(twitchUser.login);
      if (channel !== 'marved' || !CORE_MODS.has(login)) {
        return json(403, { error: 'Globale Daten dürfen nur vom ShishaWG-Core-Team geändert werden.' });
      }
    }
    if (body.action === 'db' && body.table === 'qna_settings' && body.values?.broadcaster_token) {
      if (cleanChannel(twitchUser.login) !== channel) {
        return json(403, { error: 'Den Broadcaster-Token darf nur der Kanalinhaber hinterlegen.' });
      }
    }

    if (body.action === 'giveaways.list') return json(200, { data: await listGiveaways(channel) });
    if (body.action === 'giveaways.upsert') return json(200, { data: await upsertGiveaway(channel, body.winner || {}, body.createOnly === true) });
    if (body.action === 'giveaways.delete') {
      const { error } = await admin.from('giveaway_winners').delete().eq('id', body.id).eq('channel', channel);
      if (error) throw error;
      return json(200, { data: true });
    }
    if (body.action === 'presence.heartbeat') return json(200, { data: await heartbeatPresence(channel, twitchUser, body) });
    if (body.action === 'presence.list') return json(200, { data: await listPresence(channel) });
    if (body.action === 'presence.read') return json(200, { data: await markChatRead(channel, twitchUser, body) });
    if (body.action === 'direct.list') return json(200, { data: await listDirectMessages(channel, twitchUser, body.recipientId) });
    if (body.action === 'direct.inbox') return json(200, { data: await listDirectInbox(channel, twitchUser) });
    if (body.action === 'direct.send') {
      const sent = await sendDirectMessage(channel, twitchUser, body);
      sendPushInBackground(sendPush(channel, sent.sender_user_id, sent.recipient_user_id,
        `🔒 Privat von ${sent.sender_login}`, sent.message, { kind: 'direct', senderId: sent.sender_user_id }));
      return json(200, { data: sent });
    }
    if (body.action === 'push.register') return json(200, { data: await registerPushDevice(channel, twitchUser, body) });
    if (body.action === 'push.unregister') return json(200, { data: await unregisterPushDevice(channel, twitchUser, body) });
    if (body.action === 'db') {
      const data = await runDatabaseAction(body, channel);
      notifyModChat(channel, twitchUser, body);
      return json(200, { data });
    }
    return json(400, { error: 'Unbekannte Aktion.' });
  } catch (error) {
    console.error(error);
    return json(400, { error: error instanceof Error ? error.message : 'Unbekannter Fehler' });
  }
});
