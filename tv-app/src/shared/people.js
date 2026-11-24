// Who signed up for a minyan on a day, oldest first. No Firebase here, so the WhatsApp bot
// can use it too.
export const signupList = (signups, date, id) =>
  Object.entries(signups?.[date]?.[id] || {}).map(([uid, v]) => ({ uid, ...v })).sort((a, b) => (a.at || 0) - (b.at || 0));
