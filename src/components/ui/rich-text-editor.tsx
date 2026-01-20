"use client";
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered,
  Eye,
  Link,
  Image as ImageIcon,
  Heading1,
  Heading2,
  Heading3
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({ 
  value, 
  onChange, 
  placeholder = "내용을 입력하세요...",
  className = "" 
}: RichTextEditorProps) {
  const [text, setText] = useState(value);
  const [showPreview, setShowPreview] = useState(false);

  // value가 변경되면 text도 업데이트
  useEffect(() => {
    setText(value);
  }, [value]);

  // 텍스트 변경 시 부모에게 알림
  const handleTextChange = (newText: string) => {
    setText(newText);
    onChange(newText);
  };

  // 텍스트 선택 영역 가져오기
  const getSelectedText = () => {
    const textarea = document.getElementById('rich-textarea') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      return { textarea, start, end, selectedText: text.substring(start, end) };
    }
    return null;
  };

  // 굵은 글씨 추가
  const addBold = () => {
    const selection = getSelectedText();
    if (selection) {
      const { textarea, start, end, selectedText } = selection;
      const newText = text.substring(0, start) + `<strong>${selectedText}</strong>` + text.substring(end);
      handleTextChange(newText);
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + 8, end + 8);
      }, 0);
    }
  };

  // 기울임 추가
  const addItalic = () => {
    const selection = getSelectedText();
    if (selection) {
      const { textarea, start, end, selectedText } = selection;
      const newText = text.substring(0, start) + `<em>${selectedText}</em>` + text.substring(end);
      handleTextChange(newText);
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + 4, end + 4);
      }, 0);
    }
  };

  // 제목 추가
  const addHeading = (level: number) => {
    const selection = getSelectedText();
    if (selection) {
      const { textarea, start, end, selectedText } = selection;
      const newText = text.substring(0, start) + `<h${level}>${selectedText}</h${level}>` + text.substring(end);
      handleTextChange(newText);
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + 4 + level.toString().length, end + 4 + level.toString().length);
      }, 0);
    }
  };

  // 목록 추가
  const addList = (ordered: boolean = false) => {
    const selection = getSelectedText();
    if (selection) {
      const { textarea, start, end, selectedText } = selection;
      const tag = ordered ? 'ol' : 'ul';
      const newText = text.substring(0, start) + `<${tag}><li>${selectedText}</li></${tag}>` + text.substring(end);
      handleTextChange(newText);
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + 4 + tag.length, end + 4 + tag.length);
      }, 0);
    }
  };

  // 링크 추가
  const addLink = () => {
    const selection = getSelectedText();
    if (selection) {
      const { textarea, start, end, selectedText } = selection;
      const url = prompt('URL을 입력하세요:', 'https://');
      if (url) {
        const newText = text.substring(0, start) + `<a href="${url}">${selectedText}</a>` + text.substring(end);
        handleTextChange(newText);
        
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + 9 + url.length, end + 9 + url.length);
        }, 0);
      }
    }
  };

  // 이미지 추가
  const addImage = () => {
    const selection = getSelectedText();
    if (selection) {
      const { textarea, start, end, selectedText } = selection;
      const url = prompt('이미지 URL을 입력하세요:', 'https://');
      if (url) {
        const newText = text.substring(0, start) + `<img src="${url}" alt="${selectedText}" style="max-width: 100%; height: auto;" />` + text.substring(end);
        handleTextChange(newText);
        
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + newText.length - text.length, start + newText.length - text.length);
        }, 0);
      }
    }
  };

  // HTML을 안전하게 렌더링
  const renderHtml = (htmlContent: string) => {
    return htmlContent
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\n/g, '<br>');
  };

  return (
    <div className={`border rounded-md ${className}`}>
      {/* 툴바 */}
      <div className="border-b p-2 flex flex-wrap gap-1 bg-gray-50">
        <Button
          variant="ghost"
          size="sm"
          onClick={addBold}
          title="굵은 글씨"
        >
          <Bold className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={addItalic}
          title="기울임"
        >
          <Italic className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => addHeading(1)}
          title="제목 1"
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => addHeading(2)}
          title="제목 2"
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => addHeading(3)}
          title="제목 3"
        >
          <Heading3 className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => addList(false)}
          title="순서 없는 목록"
        >
          <List className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => addList(true)}
          title="순서 있는 목록"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        <Button
          variant="ghost"
          size="sm"
          onClick={addLink}
          title="링크"
        >
          <Link className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={addImage}
          title="이미지"
        >
          <ImageIcon className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowPreview(!showPreview)}
          className={showPreview ? 'bg-blue-100 text-blue-800' : ''}
          title="미리보기"
        >
          <Eye className="h-4 w-4" />
        </Button>
      </div>

      {/* 에디터/미리보기 영역 */}
      {showPreview ? (
        <div 
          className="p-4 min-h-[200px] bg-gray-50"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div 
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: text }}
          />
        </div>
      ) : (
        <Textarea
          id="rich-textarea"
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          placeholder={placeholder}
          className="min-h-[200px] border-0 resize-none focus:ring-0"
        />
      )}

      {/* 도움말 */}
      <div className="border-t p-2 bg-gray-50 text-xs text-gray-500">
        <p>💡 <strong>사용법:</strong> 텍스트를 선택한 후 버튼을 클릭하세요.</p>
        <p>📝 <strong>지원 태그:</strong> &lt;strong&gt;, &lt;em&gt;, &lt;h1&gt;, &lt;h2&gt;, &lt;h3&gt;, &lt;ul&gt;, &lt;ol&gt;, &lt;a&gt;, &lt;img&gt;</p>
      </div>
    </div>
  );
}
