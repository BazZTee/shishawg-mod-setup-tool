'use strict';

function resolveReleaseNotes(appVersion, notes, lastSeenVersion) {
  const version = String(appVersion || '').trim();
  const release = notes && typeof notes === 'object' ? notes : null;
  const items = Array.isArray(release?.items)
    ? release.items.filter(item => item && item.title && item.description)
    : [];

  if (!version || !release || release.version !== version || items.length === 0) {
    return { success: true, shouldShow: false, version };
  }

  return {
    success: true,
    shouldShow: lastSeenVersion !== version,
    version,
    release: {
      version,
      title: release.title || `Neu in Version ${version}`,
      intro: release.intro || '',
      items: items.map(item => ({
        icon: item.icon || '✨',
        title: String(item.title),
        description: String(item.description)
      }))
    }
  };
}

module.exports = { resolveReleaseNotes };
