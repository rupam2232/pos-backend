import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "me@gmail.com",
    pass: process.env.GOOGLE_APP_PASSWORD,
  },
});

transporter.sendMail({
  from: '"Example Team" <team@example.com>', // sender address
  to: "alice@example.com, bob@example.com", // list of receivers
  subject: "Hello", // Subject line
  text: "Hello world?", // plain text body
  html: "<b>Hello world?</b>", // html body
});

type T = {
    success: boolean;
    message: string;
}

export async function sendVerificationEmail(
  email: string,
  firstName: string,
  otp: string,
  context: string
): Promise<T> {
  try {
    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE,
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    if (context && context === "signup") {
      await transporter.sendMail({
        from: `"${process.env.SERVER_NAME}" <${process.env.EMAIL}>`,
        to: email,
        subject: "Verify your email",
        html: "",
        headers: { "X-Email-Category": "Email Verification" },
      });
      return {
        success: true,
        message: "Verification email send successfully.",
      };
    } else if (context === "change-password"){
        await transporter.sendMail({
        from: `"${process.env.SERVER_NAME}" <${process.env.EMAIL}>`,
        to: email,
        subject: "Change your password",
        html: "",
        headers: { "X-Email-Category": "Change password" },
      });
      return {
        success: true,
        message: "Verification email send successfully.",
      };
    }
    return {
        success: false,
        message: "Please provide a valid context"
    }

  } catch (error) {
    console.error("Error sending verification email:", error);
    return {
      success: false,
      message: "Failed to send verification email.",
    };
  }
}
