function phoneNumberFormatter(number) {
  let formatted = number.replace(/\D/g, "");

  if (formatted.startsWith("0")) {
    formatted = "62" + formatted.substring(1);
  }

  return formatted.endsWith("@c.us") ? formatted : formatted + "@c.us";
}

function authenticateUser(req, res, next) {
  const { key } = req.body;

  if (key === process.env.AUTH_KEY) {
    next();
  } else {
    res.status(401).send({ error: "Unauthorized" });
  }
}

module.exports = {
  phoneNumberFormatter,
  authenticateUser,
};
