/**
 * Beta bug reporting — no accounts, no SDKs, mirrors the privacy stance:
 *   - email: opens the user's own mail app with app/device info pre-filled
 *   - GitHub: opens a new-issue page for technical users
 * Nothing is sent anywhere until the user hits send themselves.
 */
import { Linking, Platform } from 'react-native';

const appJson = require('../../app.json');

export const GITHUB_ISSUES_URL = 'https://github.com/SudhanshuPanthri/Aahaar/issues/new?labels=bug';
const SUPPORT_EMAIL = 'panthrisudhanshu666@gmail.com';

/** "Google Pixel 9 Pro · Android 16" / "iOS 19.1" — enough to triage most bugs. */
function deviceLine(): string {
  const c = (Platform.constants ?? {}) as Record<string, unknown>;
  if (Platform.OS === 'android') {
    return [c.Brand, c.Model, '· Android', Platform.Version].filter(Boolean).join(' ');
  }
  return `${c.systemName ?? 'iOS'} ${c.osVersion ?? Platform.Version}`;
}

export async function openBugReportEmail(): Promise<boolean> {
  const subject = `Aahaar beta — bug report (v${appJson.expo.version})`;
  const body = [
    'What happened:',
    '',
    '',
    'What I expected:',
    '',
    '',
    'Steps to reproduce:',
    '1. ',
    '',
    '---',
    `App: Aahaar v${appJson.expo.version}`,
    `Device: ${deviceLine()}`,
  ].join('\n');

  const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false; // no mail app configured — caller shows the fallback
  }
}

export function openGithubIssues(): Promise<boolean> {
  return Linking.openURL(GITHUB_ISSUES_URL).then(
    () => true,
    () => false
  );
}

export { SUPPORT_EMAIL };
