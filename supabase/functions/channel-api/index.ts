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

async function upsertGiveaway(channel: string, winner: any) {
  const row = { ...winner, channel };
  await assertNoCrossChannelIdConflict('giveaway_winners', 'channel', row, channel);
  if (row.address && typeof row.address === 'object') row.address = encryptAddress(row.address);
  const { data, error } = await admin.from('giveaway_winners').upsert(row, { onConflict: 'id' }).select('*').single();
  if (error) throw error;
  return { ...data, address: decryptAddress(data.address) };
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
    if (body.action === 'giveaways.upsert') return json(200, { data: await upsertGiveaway(channel, body.winner || {}) });
    if (body.action === 'giveaways.delete') {
      const { error } = await admin.from('giveaway_winners').delete().eq('id', body.id).eq('channel', channel);
      if (error) throw error;
      return json(200, { data: true });
    }
    if (body.action === 'db') return json(200, { data: await runDatabaseAction(body, channel) });
    return json(400, { error: 'Unbekannte Aktion.' });
  } catch (error) {
    console.error(error);
    return json(400, { error: error instanceof Error ? error.message : 'Unbekannter Fehler' });
  }
});
