import api, { REFRESH_TOKEN_KEY } from './api';

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

/** Changes the signed-in user's password. The current refresh token is sent so this session stays valid. */
export async function changePassword({
  currentPassword,
  newPassword,
}: ChangePasswordInput): Promise<void> {
  await api.post('/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
    refresh_token: localStorage.getItem(REFRESH_TOKEN_KEY),
  });
}
