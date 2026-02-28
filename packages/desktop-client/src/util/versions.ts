// @ts-strict-ignore
import * as Platform from 'loot-core/shared/platform';

function parseSemanticVersion(versionString): [number, number, number] {
  return versionString
    .replace('v', '')
    .split('.')
    .map(n => parseInt(n));
}

function cmpSemanticVersion(
  versionStringA: string,
  versionStringB: string,
): number {
  const x = parseSemanticVersion(versionStringA);
  const y = parseSemanticVersion(versionStringB);

  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

export async function getLatestVersion(): Promise<string | 'unknown'> {
  if (Platform.isPlaywright || process.env.REACT_APP_REVIEW_ID) {
    return Promise.resolve('v99.9.9');
  }

  try {
    // Use custom GitHub repo if configured, otherwise default to skyengpro fork
    const githubRepo =
      process.env.REACT_APP_GITHUB_REPO || 'skyengpro/actualbudget';
    const response = await fetch(
      `https://api.github.com/repos/${githubRepo}/releases/latest`,
    );
    const json = await response.json();
    return json?.tag_name ?? 'unknown';
  } catch {
    // Rate limit exceeded? Or perhaps GitHub is down?
    return 'unknown';
  }
}

export function getIsOutdated(latestVersion: string): boolean {
  const clientVersion = window.Actual?.ACTUAL_VERSION;
  if (latestVersion === 'unknown' || !clientVersion) {
    return false;
  }
  return cmpSemanticVersion(clientVersion, latestVersion) < 0;
}
