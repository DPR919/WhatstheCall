const INVITE_CODE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomChar(): string {
  const index = Math.floor(Math.random() * INVITE_CODE_CHARSET.length);
  return INVITE_CODE_CHARSET[index];
}

export function generateInviteCode(): string {
  const firstBlock = Array.from({ length: 4 }, randomChar).join("");
  const secondBlock = Array.from({ length: 4 }, randomChar).join("");

  return `${firstBlock}-${secondBlock}`;
}
