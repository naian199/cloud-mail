// Back from a detail page: return through this site's own history when there is one; a page
// opened directly (new tab, shared link, after sign-in) goes to its module's list instead.
export function goBack(router, fallback) {
  if (window.history.state?.back) router.back();
  else router.replace(fallback);
}
