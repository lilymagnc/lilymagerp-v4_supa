import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
    try {
        const { toEmail, documentType, userName, branchName, startDate, endDate, reason } = await req.json();

        if (!toEmail) {
            return NextResponse.json({ error: '수신자 이메일 주소가 없습니다.' }, { status: 400 });
        }

        // Configure Nodemailer 
        // Uses Google's SMTP by default, or you can supply other SMTP config in .env.local
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SMTP_USER, // e.g. "my_email@gmail.com"
                pass: process.env.SMTP_PASS, // e.g. App Password for Gmail
            },
        });

        const mailOptions = {
            from: `"인사 관리 시스템" <${process.env.SMTP_USER || 'noreply@example.com'}>`,
            to: toEmail,
            subject: `[승인 완료] ${branchName || ''} ${userName}님의 ${documentType} 신청이 승인되었습니다.`,
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #10b981; border-bottom: 2px solid #10b981; padding-bottom: 10px;">인사 서류 승인 안내</h2>
          <p>안녕하세요. 제출하신 <strong>${documentType}</strong> 신청서가 본사에 의해 <strong>승인</strong>되었습니다.</p>
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <ul style="list-style-type: none; padding: 0; margin: 0;">
              <li style="margin-bottom: 10px;"><strong>신청자:</strong> ${userName} (${branchName || '지점 정보 없음'})</li>
              <li style="margin-bottom: 10px;"><strong>서류 종류:</strong> ${documentType}</li>
              ${startDate && endDate ? `<li style="margin-bottom: 10px;"><strong>기간:</strong> ${new Date(startDate).toLocaleDateString()} ~ ${new Date(endDate).toLocaleDateString()}</li>` : ''}
              ${reason ? `<li style="margin-bottom: 10px;"><strong>사유:</strong> ${reason}</li>` : ''}
            </ul>
          </div>
          <p style="color: #64748b; font-size: 0.9em;">시스템에 방문하여 "확인완료" 버튼을 클릭해주시기 바랍니다.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 0.8em; color: #94a3b8; text-align: center;">본 메일은 발신 전용 메일입니다.</p>
        </div>
      `,
        };

        // If SMTP credentials aren't configured, just fake success for dev
        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            console.warn("SMTP credentials not configured. Email was NOT sent, but simulating success.");
            return NextResponse.json({ message: 'SMTP 설정이 없어 이메일 전송을 시뮬레이션 했습니다.', simulated: true });
        }

        const info = await transporter.sendMail(mailOptions);
        console.log("Message sent: %s", info.messageId);

        return NextResponse.json({ message: '이메일이 성공적으로 전송되었습니다.', messageId: info.messageId });
    } catch (error: any) {
        console.error('Email sending error:', error);
        return NextResponse.json({ error: '이메일 전송 중 오류가 발생했습니다.', details: error.message }, { status: 500 });
    }
}
