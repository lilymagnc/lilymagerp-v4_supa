"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Eye, Code } from 'lucide-react'
import { EmailTemplateLibrary } from './email-template-library'

interface EmailTemplateEditorProps {
  templateName: string
  value: string
  onChange: (value: string) => void
  variables: string[]
  className?: string
}

// 기본 HTML 템플릿들
const htmlTemplates = {
  modern: {
    name: "모던 스타일",
    template: `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{제목}</title>
    <style>
        body { margin: 0; padding: 0; font-family: 'Noto Sans KR', Arial, sans-serif; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 300; }
        .content { padding: 40px 30px; }
        .greeting { font-size: 18px; color: #333; margin-bottom: 20px; }
        .info-box { background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; }
        .info-row { display: flex; justify-content: space-between; margin: 10px 0; }
        .info-label { font-weight: bold; color: #555; }
        .info-value { color: #333; }
        .button { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 25px; margin: 20px 0; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{회사명}</h1>
        </div>
        <div class="content">
            <div class="greeting">안녕하세요, {고객명}님! 👋</div>
            <p>주문이 성공적으로 접수되었습니다.</p>
            
            <div class="info-box">
                <div class="info-row">
                    <span class="info-label">주문번호:</span>
                    <span class="info-value">{주문번호}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">주문일:</span>
                    <span class="info-value">{주문일}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">총 금액:</span>
                    <span class="info-value">{총금액}원</span>
                </div>
            </div>
            
            <p>주문해 주셔서 진심으로 감사드립니다. 최고의 서비스로 보답하겠습니다.</p>
        </div>
        <div class="footer">
            <p>{회사명} | 문의: {연락처}</p>
            <p>이 이메일은 자동으로 발송된 메일입니다.</p>
        </div>
    </div>
</body>
</html>`
  },
  elegant: {
    name: "엘레간트 스타일", 
    template: `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{제목}</title>
    <style>
        body { margin: 0; padding: 0; font-family: 'Noto Serif KR', serif; background-color: #fafafa; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e0e0e0; }
        .header { background-color: #2c3e50; padding: 40px; text-align: center; }
        .header h1 { color: #ecf0f1; margin: 0; font-size: 28px; font-weight: 400; letter-spacing: 2px; }
        .content { padding: 50px 40px; line-height: 1.6; }
        .greeting { font-size: 20px; color: #2c3e50; margin-bottom: 30px; text-align: center; }
        .divider { width: 60px; height: 2px; background-color: #3498db; margin: 30px auto; }
        .info-table { width: 100%; border-collapse: collapse; margin: 30px 0; }
        .info-table td { padding: 15px 0; border-bottom: 1px solid #ecf0f1; }
        .info-table .label { font-weight: bold; color: #34495e; width: 30%; }
        .info-table .value { color: #2c3e50; }
        .message { background-color: #ecf0f1; padding: 25px; margin: 30px 0; border-radius: 5px; font-style: italic; text-align: center; }
        .footer { background-color: #34495e; padding: 30px; text-align: center; color: #bdc3c7; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{회사명}</h1>
        </div>
        <div class="content">
            <div class="greeting">{고객명}님께</div>
            <div class="divider"></div>
            
            <p>소중한 주문을 해주셔서 진심으로 감사드립니다.</p>
            
            <table class="info-table">
                <tr>
                    <td class="label">주문번호</td>
                    <td class="value">{주문번호}</td>
                </tr>
                <tr>
                    <td class="label">주문일시</td>
                    <td class="value">{주문일}</td>
                </tr>
                <tr>
                    <td class="label">결제금액</td>
                    <td class="value">{총금액}원</td>
                </tr>
            </table>
            
            <div class="message">
                "최고의 품질과 서비스로 고객님의 만족을 위해 최선을 다하겠습니다."
            </div>
            
            <p>추가 문의사항이 있으시면 언제든지 연락해 주세요.</p>
        </div>
        <div class="footer">
            <p>{회사명}</p>
            <p>문의: {연락처} | 이메일: {이메일}</p>
        </div>
    </div>
</body>
</html>`
  },
  minimal: {
    name: "미니멀 스타일",
    template: `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{제목}</title>
    <style>
        body { margin: 0; padding: 0; font-family: 'Noto Sans KR', Arial, sans-serif; background-color: #ffffff; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
        .header { text-align: center; margin-bottom: 40px; }
        .header h1 { font-size: 24px; font-weight: 700; color: #333; margin: 0; }
        .header .subtitle { color: #666; font-size: 14px; margin-top: 5px; }
        .content { max-width: 400px; margin: 0 auto; }
        .greeting { font-size: 18px; margin-bottom: 30px; }
        .info-list { list-style: none; padding: 0; margin: 30px 0; }
        .info-list li { padding: 10px 0; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; }
        .info-list .label { color: #666; }
        .info-list .value { font-weight: 600; }
        .thank-you { text-align: center; margin: 40px 0; padding: 20px; background-color: #f9f9f9; border-radius: 8px; }
        .footer { text-align: center; margin-top: 50px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #999; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{회사명}</h1>
            <div class="subtitle">주문 확인</div>
        </div>
        
        <div class="content">
            <div class="greeting">안녕하세요, {고객명}님</div>
            
            <p>주문이 정상적으로 접수되었습니다.</p>
            
            <ul class="info-list">
                <li>
                    <span class="label">주문번호</span>
                    <span class="value">{주문번호}</span>
                </li>
                <li>
                    <span class="label">주문일</span>
                    <span class="value">{주문일}</span>
                </li>
                <li>
                    <span class="label">총 금액</span>
                    <span class="value">{총금액}원</span>
                </li>
            </ul>
            
            <div class="thank-you">
                <p>감사합니다.</p>
            </div>
        </div>
        
        <div class="footer">
            <p>{회사명} | {연락처}</p>
            <p>본 메일은 자동발송되었습니다.</p>
        </div>
    </div>
</body>
</html>`
  }
}

export function EmailTemplateEditor({ templateName, value, onChange, variables, className }: EmailTemplateEditorProps) {
  const [activeTab, setActiveTab] = useState<'text' | 'html' | 'preview'>('text')
  const [selectedTemplate, setSelectedTemplate] = useState<string>('custom')

  const handleTemplateSelect = (templateKey: string) => {
    if (templateKey === "custom") {
      setSelectedTemplate(templateKey)
      return
    }
    
    if (templateKey && htmlTemplates[templateKey]) {
      onChange(htmlTemplates[templateKey].template)
      setSelectedTemplate(templateKey)
      setActiveTab('html')
    }
  }

  const generatePreviewHtml = () => {
    let preview = value
    
    // 샘플 데이터로 변수 치환
    const sampleData = {
      '고객명': '홍길동',
      '주문번호': 'ORD-20241201-001',
      '주문일': '2024년 12월 1일',
      '총금액': '125,000',
      '회사명': '릴리맥 플라워샵',
      '연락처': '02-1234-5678',
      '이메일': 'info@lilymag.com',
      '배송일': '2024년 12월 3일',
      '이전상태': '주문접수',
      '현재상태': '배송완료',
      '제목': templateName
    }

    Object.entries(sampleData).forEach(([key, val]) => {
      const regex = new RegExp(`{${key}}`, 'g')
      preview = preview.replace(regex, val)
    })

    return preview
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            {templateName} 템플릿 편집기
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 템플릿 선택 */}
          <div className="space-y-2">
            <Label>미리 만들어진 템플릿 선택</Label>
            <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
              <SelectTrigger>
                <SelectValue placeholder="템플릿을 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">직접 작성</SelectItem>
                {Object.entries(htmlTemplates).map(([key, template]) => (
                  <SelectItem key={key} value={key}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 템플릿 라이브러리 */}
          <EmailTemplateLibrary
            currentTemplate={value}
            onTemplateSelect={onChange}
            category={templateName === '주문확인' ? 'order' : 
                     templateName === '배송완료' ? 'delivery' : 
                     templateName === '상태변경' ? 'status' : 
                     templateName === '생일축하' ? 'birthday' : 'custom'}
            variables={variables}
          />

          {/* 사용 가능한 변수 */}
          <div className="space-y-2">
            <Label>사용 가능한 변수</Label>
            <div className="flex flex-wrap gap-2">
              {variables.map((variable) => (
                <Button
                  key={variable}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const textarea = document.querySelector(`#${templateName}`) as HTMLTextAreaElement
                    if (textarea) {
                      const cursorPos = textarea.selectionStart
                      const textBefore = value.substring(0, cursorPos)
                      const textAfter = value.substring(cursorPos)
                      const newValue = textBefore + `{${variable}}` + textAfter
                      onChange(newValue)
                      setTimeout(() => {
                        textarea.setSelectionRange(cursorPos + variable.length + 2, cursorPos + variable.length + 2)
                        textarea.focus()
                      }, 0)
                    }
                  }}
                  className="text-xs"
                >
                  {`{${variable}}`}
                </Button>
              ))}
            </div>
          </div>

          {/* 편집 탭 */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="text">텍스트</TabsTrigger>
              <TabsTrigger value="html">HTML</TabsTrigger>
              <TabsTrigger value="preview" className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                미리보기
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="text" className="space-y-2">
              <Label>텍스트 템플릿</Label>
              <Textarea
                id={templateName}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="이메일 템플릿을 입력하세요..."
                className="min-h-[200px] font-mono text-sm"
              />
            </TabsContent>
            
            <TabsContent value="html" className="space-y-2">
              <Label>HTML 템플릿</Label>
              <Textarea
                id={`${templateName}-html`}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="HTML 이메일 템플릿을 입력하세요..."
                className="min-h-[400px] font-mono text-sm whitespace-pre-wrap"
                spellCheck={false}
              />
            </TabsContent>
            
            <TabsContent value="preview" className="space-y-2">
              <Label>미리보기 (샘플 데이터)</Label>
              <div className="border rounded-md p-4 bg-gray-50 max-h-[400px] overflow-auto">
                {value.includes('<!DOCTYPE html') || value.includes('<html') ? (
                  <iframe
                    srcDoc={generatePreviewHtml()}
                    className="w-full h-[400px] border-0"
                    title="이메일 미리보기"
                  />
                ) : (
                  <pre className="whitespace-pre-wrap text-sm">
                    {generatePreviewHtml()}
                  </pre>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
