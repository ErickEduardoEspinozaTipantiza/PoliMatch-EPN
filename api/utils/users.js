export const PUBLIC_USER_FIELDS =
  "name age bio image photos interests relationshipGoal city university";

export function userPhotos(user) {
  return user.photos?.length
    ? [...user.photos]
    : user.image
      ? [user.image]
      : [];
}

export function publicUser(user) {
  return {
    _id: user._id,
    name: user.name,
    age: user.age,
    bio: user.bio || "",
    image: user.image || "",
    photos: userPhotos(user),
    interests: user.interests || [],
    relationshipGoal: user.relationshipGoal || "",
    city: user.city || "",
    university: user.university || "",
  };
}

export function ownUser(user) {
  return {
    ...publicUser(user),
    gender: user.gender,
    genderPreference: user.genderPreference,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
