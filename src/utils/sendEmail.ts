import nodemailer from "nodemailer";

type T = {
  success: boolean;
  message: string;
};

const optionsArray = [
  {
    context: "signup",
    emailCategory: "Email Verification",
    subject: "Verify your email",
  },
  {
    context: "signup-success",
    emailCategory: "Signup",
    subject: "Sign up successful",
  },
  {
    context: "change-password",
    emailCategory: "Change password",
    subject: "Password change request",
  }, {
    context: "new-login",
    emailCategory: "New Login",
    subject: "New login detected",
  }, {
    context: "restaurant-created",
    emailCategory: "Restaurant Created",
    subject: "Your restaurant has been created",
  },
];

async function sendEmail(
  email: string,
  context: "signup" | "signup-success" | "change-password" | "new-login" | "restaurant-created",
  template: string,
): Promise<T> {
  try {
    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE,
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    for (const options of optionsArray) {
      if (context === options.context) {
        await transporter.sendMail({
          from: `"${process.env.SERVER_NAME}" <${process.env.EMAIL}>`,
          to: email,
          subject: options.subject,
          html: template,
          headers: { "X-Email-Category": options.emailCategory },
        });
        return {
          success: true,
          message: "Email sent successfully",
        };
      }
    }
    return {
      success: false,
      message: "Please provide a valid context",
    };
  } catch (error) {
    console.error("Error sending email:", error);
    return {
      success: false,
      message: "Failed to send email",
    };
  }
}

export default sendEmail
