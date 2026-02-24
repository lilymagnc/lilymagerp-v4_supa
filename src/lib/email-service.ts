import { SystemSettings } from '@/hooks/use-settings';

// HTML 콘텐츠인지 감지하는 함수
function isHtml(content: string): boolean {
  return content.includes('<!DOCTYPE html') ||
    content.includes('<html') ||
    content.includes('<body') ||
    content.includes('<div') ||
    content.includes('<p') ||
    content.includes('<table');
}

// 이메일 템플릿에서 변수를 실제 값으로 치환하는 함수
export function replaceTemplateVariables(template: string, variables: Record<string, string | number>): string {
  let result = template;
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{${key}}`;
    result = result.replace(new RegExp(placeholder, 'g'), String(value));
  });
  return result;
}
// 배송완료 이메일 발송
export async function sendDeliveryCompleteEmail(
  customerEmail: string,
  customerName: string,
  orderNumber: string,
  deliveryDate: string,
  settings: SystemSettings,
  completionPhotoUrl?: string
): Promise<boolean> {
  if (!settings.autoEmailDeliveryComplete) {
    return false;
  }
  try {
    let emailContent = replaceTemplateVariables(settings.emailTemplateDeliveryComplete, {
      고객명: customerName,
      주문번호: orderNumber,
      배송일: deliveryDate,
      회사명: settings.siteName
    });

    // 배송완료 사진이 있는 경우 이메일에 포함
    if (completionPhotoUrl) {
      if (isHtml(emailContent)) {
        // HTML 이메일인 경우 이미지 태그 추가
        const photoHtml = `
          <div style="margin: 20px 0; text-align: center;">
            <h3 style="color: #333; margin-bottom: 10px;">📸 배송완료 확인 사진</h3>
            <img src="${completionPhotoUrl}" alt="배송완료 확인 사진" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
          </div>
        `;
        // </body> 태그 바로 앞에 사진 삽입
        emailContent = emailContent.replace('</body>', photoHtml + '</body>');
      } else {
        // 텍스트 이메일인 경우 사진 URL 추가
        emailContent += `\n\n📸 배송완료 확인 사진: ${completionPhotoUrl}`;
      }
    }

    // 실제 이메일 발송 로직 (Serverless Functions 또는 외부 이메일 서비스 사용)
    await sendEmail(customerEmail, `${settings.siteName} - 배송완료 알림`, emailContent, isHtml(emailContent));
    return true;
  } catch (error) {
    console.error('배송완료 이메일 발송 실패:', error);
    return false;
  }
}
// 주문확인 이메일 발송
export async function sendOrderConfirmEmail(
  customerEmail: string,
  customerName: string,
  orderNumber: string,
  orderDate: string,
  totalAmount: number,
  settings: SystemSettings
): Promise<boolean> {
  if (!settings.autoEmailOrderConfirm) {
    return false;
  }
  try {
    const emailContent = replaceTemplateVariables(settings.emailTemplateOrderConfirm, {
      고객명: customerName,
      주문번호: orderNumber,
      주문일: orderDate,
      총금액: totalAmount.toLocaleString(),
      회사명: settings.siteName
    });
    await sendEmail(customerEmail, `${settings.siteName} - 주문확인`, emailContent, isHtml(emailContent));
    return true;
  } catch (error) {
    console.error('주문확인 이메일 발송 실패:', error);
    return false;
  }
}
// 상태변경 이메일 발송
export async function sendStatusChangeEmail(
  customerEmail: string,
  customerName: string,
  orderNumber: string,
  previousStatus: string,
  currentStatus: string,
  settings: SystemSettings
): Promise<boolean> {
  if (!settings.autoEmailStatusChange) {
    return false;
  }
  try {
    const emailContent = replaceTemplateVariables(settings.emailTemplateStatusChange, {
      고객명: customerName,
      주문번호: orderNumber,
      이전상태: previousStatus,
      현재상태: currentStatus,
      회사명: settings.siteName
    });
    await sendEmail(customerEmail, `${settings.siteName} - 주문상태 변경 알림`, emailContent, isHtml(emailContent));
    return true;
  } catch (error) {
    console.error('상태변경 이메일 발송 실패:', error);
    return false;
  }
}
// 생일축하 이메일 발송
export async function sendBirthdayEmail(
  customerEmail: string,
  customerName: string,
  settings: SystemSettings
): Promise<boolean> {
  if (!settings.autoEmailBirthday) {
    return false;
  }
  try {
    const emailContent = replaceTemplateVariables(settings.emailTemplateBirthday, {
      고객명: customerName,
      회사명: settings.siteName
    });
    await sendEmail(customerEmail, `${settings.siteName} - 생일 축하드립니다!`, emailContent, isHtml(emailContent));
    return true;
  } catch (error) {
    console.error('생일축하 이메일 발송 실패:', error);
    return false;
  }
}
// 실제 이메일 발송 함수 (Serverless Functions 또는 외부 서비스 연동)
async function sendEmail(to: string, subject: string, content: string, isHtmlContent: boolean = false): Promise<void> {
  // 개발환경에서는 콘솔에 이메일 내용 출력
  if (process.env.NODE_ENV === 'development') {
    return;
  }

  // 실제 이메일 발송 로직 구현
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        subject,
        content,
        isHtml: isHtmlContent
      })
    });

    if (!response.ok) {
      throw new Error('이메일 발송 실패');
    }
  } catch (error) {
    console.error('이메일 발송 오류:', error);
    throw error;
  }
}
// 메시지 스타일 적용 함수
export function applyMessageStyle(message: string, settings: SystemSettings): string {
  return `
    <div style="
      font-family: '${settings.messageFont}', sans-serif;
      font-size: ${settings.messageFontSize}px;
      color: ${settings.messageColor};
    ">
      ${message}
    </div>
  `;
} 
