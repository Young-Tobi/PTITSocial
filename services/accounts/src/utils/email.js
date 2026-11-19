const path = require('node:path');
const nodemailer = require('nodemailer');
const pug = require('pug');
const { htmlToText } = require('html-to-text');

// Email belongs to Accounts; SMTP is Mailpit on the local development stack.
module.exports = class Email {
  constructor(user, url) {
    this.to = user.email;
    this.firstname = user.first_name;
    this.url = url;
  }

  async send(template, subject) {
    const html = pug.renderFile(path.join(__dirname, '../views/emails', template + '.pug'), {
      firstname: this.firstname,
      url: this.url,
      subject,
    });
    const options = process.env.SMTP_HOST
      ? { host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 1025), secure: false }
      : {
          service: 'Gmail',
          auth: { user: process.env.EMAIL_ID, pass: process.env.GMAIL_APP_PASSWORD },
        };
    await nodemailer.createTransport(options).sendMail({
      to: this.to,
      from: { name: 'PTITSocial', address: process.env.EMAIL_ID },
      subject,
      text: htmlToText(html),
      html,
      attachments: [{
        filename: 'ptitsocial.png',
        path: path.join(__dirname, '../views/emails/assets/ptitsocial.png'),
        cid: 'ptitsocial-logo',
      }],
    });
  }

  async sendVerificationEmail() {
    await this.send('VerificationEmail', 'PTITSocial · Xác nhận tài khoản');
  }

  async sendPasswordReset() {
    await this.send(
      'PasswordReset',
      'PTITSocial · Mã đặt lại mật khẩu (hiệu lực 10 phút)'
    );
  }
};
