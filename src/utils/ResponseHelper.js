export const responseHelpers = (req, res, next) => {
  res.success = function (data, message = "Success", statusCode = 200) {
    return this.status(statusCode).json({
      success: true,
      statusCode: statusCode,
      message,
      data,
    });
  };

  res.created = function (
    data,
    message = "Resource Created",
    statusCode = 201,
  ) {
    return this.status(statusCode).json({
      success: true,
      statusCode: statusCode,
      message,
      data,
    });
  };

  res.noContent = function (message = "No Content", statusCode = 204) {
    return this.status(statusCode).json({
      success: true,
      statusCode: statusCode,
      message,
    });
  };

  res.paginated = function (data, page, limit, total, message = "Success") {
    const totalPages = Math.ceil(total / limit);

    return this.status(200).json({
      success: true,
      statusCode: 200,
      message,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  };

  res.error = function (message, statusCode = 400, details = null) {
    return this.status(statusCode).json({
      success: false,
      statusCode: statusCode,
      error: {
        message,
        ...details(details && { details }),
      },
    });
  };

  next();
};
