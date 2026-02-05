export const schemas = {
  register: {
    username: { required: true, type: "string", minLength: 3, maxLength: 30 },
    email: {
      required: true,
      type: "string",
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    password: { required: true, type: "string", minLength: 6 },
    firstName: { required: false, type: "string", maxLength: 50 },
    lastName: { required: false, type: "string", maxLength: 50 },
  },

  login: {
    identifier: { required: true, type: "string" },
    password: { required: true, type: "string" },
  },

  createPost: {
    title: { required: true, type: "string", minLength: 3, maxLength: 200 },
    content: { required: true, type: "string", minLength: 50 },
    category: {
      required: true,
      type: "string",
      enum: [
        "technology",
        "lifestyle",
        "education",
        "entertainment",
        "business",
      ],
    },
    tags: { required: false, type: "array" },
    status: {
      required: false,
      type: "string",
      enum: ["draft", "published", "archived"],
    },
  },

  createComment: {
    content: { required: true, type: "string", minLength: 1, maxLength: 2000 },
    post: { required: true, type: "string" },
    parentComment: { required: false, type: "string" },
  },

  updateComment: {
    content: { required: false, type: "string", minLength: 1, maxLength: 2000 },
  },

  reportComment: {
    content: { required: true, type: "string", minLength: 1, maxLength: 2000 },
    post: { required: true, type: "string" },
  },

  toggleLike: {
    comment: { required: true, type: "string" },
  },
};
