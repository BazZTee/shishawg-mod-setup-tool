// Last presentation script: also release the loading guard on a normal reload.
// The main process separately waits for fonts and completed frames before the
// first native window reveal. No network or application data is awaited here.
if (document.body.classList.contains('swg-glass') && document.querySelector('.workspace-sidebar') && document.querySelector('.glass-setup-layout')) {
  document.documentElement.classList.remove('swg-starting');
}
