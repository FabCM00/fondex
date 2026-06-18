import { EmailClient } from "@azure/communication-email";
import { render } from "@react-email/components";
import * as React from "react";
const client = new EmailClient(process.env.AZURE_EMAIL_CONNECTION_STRING!);
import FondexInvitationEmail from "@/emails/fondex-invitation";
import FondexPasswordResetEmail from "@/emails/fondex-password-reset";

const FROM = process.env.EMAIL_FROM!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!.replace(/\/$/, "");

export async function sendPasswordResetEmail(
  to: string,
  token: string,
  userFirstname?: string,
): Promise<void> {
  const link = `${APP_URL}/set-password?token=${token}`;

  const html = await render(<FondexPasswordResetEmail resetPasswordLink={link} userFirstname={userFirstname} />);

  const poller = await client.beginSend({
    senderAddress: FROM,
    content: {
      subject: "Recuperación de contraseña — WANT TECH 4 ALL",
      html,
    },
    recipients: { to: [{ address: to }] },
  });
  await poller.pollUntilDone();
}

export async function sendInvitationEmail(
  to: string,
  token: string,
  invitedByName?: string,
): Promise<void> {
  const link = `${APP_URL}/set-password?token=${token}&type=invite`;

  const html = await render(
    <FondexInvitationEmail 
      acceptInvitationLink={link} 
      inviterName={invitedByName ?? "Un administrador"} 
      organizationName="WANT N' GET"
    />,
  );

  const poller = await client.beginSend({
    senderAddress: FROM,
    content: {
      subject: "Invitación de acceso — WANT TECH 4 ALL",
      html,
    },
    recipients: { to: [{ address: to }] },
  });
  await poller.pollUntilDone();
}