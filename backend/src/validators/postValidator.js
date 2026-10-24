export const validateCreatePost = (data) => {
  if (!data.title || data.title.trim().length < 3) return 'Title must be at least 3 characters.';
  if (!data.body || data.body.trim().length < 5) return 'Body content must be at least 5 characters.';
  return null;
};
