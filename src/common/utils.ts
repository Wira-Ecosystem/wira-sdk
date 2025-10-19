export function getUri(appName: string) {
  const modifiedAppName = appName.replace(/^com\./, '');
  return `content://com.wira.${modifiedAppName}.provider/user/1`;
}
