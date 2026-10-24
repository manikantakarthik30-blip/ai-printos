// Adobe Express Embed SDK v4 integration.
// Documentation: https://developer.adobe.com/express/embed-sdk/docs/guides/quickstart/
// Requires an Adobe Developer Console project with the Embed SDK enabled and this site's domain allow-listed.
// The client ID is public by design and is served from /api/config.

export const CDN_URL = 'https://cc-embed.adobe.com/sdk/v4/CCEverywhere.js';
let ccEverywherePromise = null;

// Step 2: Embed the SDK via dynamic import with script tag fallback
export async function loadSdk() {
  if (typeof window !== 'undefined' && window.CCEverywhere) {
    return window.CCEverywhere;
  }

  // Method 1: using import()
  try {
    await import(CDN_URL);
    if (window.CCEverywhere) return window.CCEverywhere;
  } catch {
    // fallback to dynamic script
  }

  // Method 2: Dynamic script injection
  return new Promise((resolve, reject) => {
    if (window.CCEverywhere) return resolve(window.CCEverywhere);
    const existing = document.querySelector(`script[src*="CCEverywhere.js"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.CCEverywhere));
      existing.addEventListener('error', () => reject(new Error('The Adobe Express SDK script failed to load.')));
      return;
    }
    const script = document.createElement('script');
    script.src = CDN_URL;
    script.async = true;
    script.onload = () => {
      if (window.CCEverywhere) resolve(window.CCEverywhere);
      else reject(new Error('CCEverywhere initialized but object not found on window.'));
    };
    script.onerror = () => reject(new Error('The Adobe Express SDK could not be loaded from ' + CDN_URL + ' (check network or Content-Security-Policy).'));
    document.head.append(script);
  });
}

// Step 3: Initialize the SDK (once per page session)
export async function initAdobeSdk(cfg) {
  if (!cfg || !cfg.clientId) {
    throw new Error('ADOBE_EXPRESS_CLIENT_ID is not configured.');
  }

  if (!ccEverywherePromise) {
    ccEverywherePromise = (async () => {
      const CCEverywhere = await loadSdk();
      const hostInfo = {
        clientId: cfg.clientId,
        appName: cfg.appName || 'AI PrintOS'
      };
      const configParams = {
        locale: 'en_US'
      };
      return CCEverywhere.initialize(hostInfo, configParams);
    })().catch((err) => {
      ccEverywherePromise = null;
      throw err;
    });
  }
  return ccEverywherePromise;
}

// Helper: Normalize exported asset payload into a usable image data URL
function pick(params) {
  if (!params) return null;
  const a = params.asset || params.exportData || params;
  const first = Array.isArray(a) ? a[0] : a;
  let d = first && (first.data || first.url);
  if (!d && typeof params.data === 'string') d = params.data;
  if (typeof d !== 'string') return null;
  if (d.startsWith('blob:') || d.startsWith('http://') || d.startsWith('https://')) return d;
  if (!d.startsWith('data:')) d = 'data:image/png;base64,' + d;
  return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(d) ? d : null;
}

// Launch the Full Editor (v4 editor.create with v3 fallback)
// mode "edit": loads current design image into Adobe Express. mode "create": starts a blank canvas.
export async function openInAdobe(cfg, mode, dataUrl) {
  const cc = await initAdobeSdk(cfg);

  return new Promise((resolve, reject) => {
    const handlePublish = (intent, publishParams) => {
      const p = publishParams || intent;
      const img = pick(p);
      if (img) resolve(img);
      else reject(new Error('Adobe Express published without returning image data.'));
    };

    const handleCancel = () => resolve(null);
    const handleError = (e) => reject(new Error((e && e.message) || 'Adobe Express reported an error.'));

    // V4 API: cc.editor.create()
    if (cc && cc.editor && typeof cc.editor.create === 'function') {
      const docConfig = {};
      if (mode === 'edit' && dataUrl) {
        docConfig.asset = {
          type: 'image',
          dataType: 'base64',
          data: dataUrl
        };
      }

      const appConfig = {
        callbacks: {
          onPublish: handlePublish,
          onCancel: handleCancel,
          onError: handleError
        }
      };

      const exportConfig = [
        {
          id: 'save-to-printos',
          label: 'Save to AI PrintOS',
          action: { target: 'publish' },
          style: { uiType: 'button' }
        },
        {
          id: 'download',
          label: 'Download',
          action: { target: 'download' },
          style: { uiType: 'button' }
        }
      ];

      try {
        cc.editor.create(docConfig, appConfig, exportConfig);
      } catch (err) {
        reject(err);
      }
      return;
    }

    // V3 / Legacy fallback: cc.createDesign() / cc.editDesign()
    const callbacks = {
      onPublish: (p) => { const img = pick(p); img ? resolve(img) : reject(new Error('Adobe Express returned no image.')); },
      onCancel: handleCancel,
      onError: handleError
    };
    const outputParams = { outputType: 'base64' };

    if (mode === 'edit' && dataUrl) {
      if (typeof cc.editDesign === 'function') {
        cc.editDesign({ inputParams: { asset: { data: dataUrl, dataType: 'base64', type: 'image' } }, outputParams, callbacks });
      } else if (typeof cc.createDesign === 'function') {
        cc.createDesign({ inputParams: { asset: { data: dataUrl, dataType: 'base64', type: 'image' } }, outputParams, callbacks });
      } else {
        reject(new Error('Neither editor.create nor createDesign is supported by this SDK version.'));
      }
    } else {
      if (typeof cc.createDesign === 'function') {
        cc.createDesign({ outputParams, callbacks });
      } else {
        reject(new Error('createDesign is not supported by this SDK version.'));
      }
    }
  });
}

// Quick Actions: fast one-click tools like background removal, resize, crop, and convert
export async function openQuickAction(cfg, actionName, dataUrl) {
  const cc = await initAdobeSdk(cfg);
  if (!cc || !cc.quickAction) {
    throw new Error('Quick Actions are not supported in this SDK environment.');
  }

  const fn = cc.quickAction[actionName];
  if (typeof fn !== 'function') {
    throw new Error(`Quick Action '${actionName}' is not available.`);
  }

  return new Promise((resolve, reject) => {
    const docConfig = dataUrl ? {
      asset: {
        type: 'image',
        dataType: 'base64',
        data: dataUrl
      }
    } : {};

    const appConfig = {
      callbacks: {
        onPublish: (intent, publishParams) => {
          const p = publishParams || intent;
          const img = pick(p);
          resolve(img || null);
        },
        onCancel: () => resolve(null),
        onError: (e) => reject(new Error((e && e.message) || 'Quick Action error.'))
      }
    };

    try {
      fn.call(cc.quickAction, docConfig, appConfig);
    } catch (err) {
      reject(err);
    }
  });
}
