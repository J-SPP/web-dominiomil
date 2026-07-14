import * as argon2 from 'argon2';

export async function hashPassword(password) {
  return await argon2.hash(password, {
    type: argon2.argon2id,
  });
}

export async function verifyPassword(hash, password) {
  try {
    return await argon2.verify(hash, password);
  } catch (error) {
    return false;
  }
}
