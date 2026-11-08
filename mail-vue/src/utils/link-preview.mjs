export const isLinkPreviewImageType = value => /^image\/(png|jpeg|gif|webp|avif)(?:;|$)/i.test(String(value||'').trim());
export function previewRequestFailure(error) {
  const status=Number(error?.response?.status||error?.status||error?.code);
  if([401,403,404].includes(status))return 'permission';
  if(['ECONNABORTED','ETIMEDOUT'].includes(error?.code))return 'timeout';
  return 'api';
}
export function previewFailureKey(reason) {
  return ({blocked:'previewReasonBlocked',challenge:'previewReasonChallenge',dns:'previewReasonDns',timeout:'previewReasonTimeout',network:'previewReasonNetwork',http:'previewReasonHttp','no-metadata':'previewReasonNoMetadata','not-html':'previewReasonContent',restricted:'previewReasonRestricted',redirect:'previewReasonRedirect',permission:'previewReasonPermission',api:'previewReasonApi'})[reason]||'linkPreviewFailed';
}
