"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Save, Star, StarOff, Eye, Trash2, Copy, Download, Upload } from 'lucide-react'
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, serverTimestamp, query, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/hooks/use-auth'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'

interface EmailTemplate {
  id: string
  name: string
  description: string
  content: string
  category: 'delivery' | 'order' | 'status' | 'birthday' | 'custom'
  isHtml: boolean
  isFavorite: boolean
  createdAt: any
  createdBy: string
  variables: string[]
}

interface EmailTemplateLibraryProps {
  currentTemplate: string
  onTemplateSelect: (template: string) => void
  category: 'delivery' | 'order' | 'status' | 'birthday' | 'custom'
  variables: string[]
}

export function EmailTemplateLibrary({ 
  currentTemplate, 
  onTemplateSelect, 
  category,
  variables 
}: EmailTemplateLibraryProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [isSaveOpen, setIsSaveOpen] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null)
  const [saveForm, setSaveForm] = useState({
    name: '',
    description: '',
    isFavorite: false
  })
  
  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const templatesRef = collection(db, 'emailTemplates')
      const q = query(templatesRef, orderBy('createdAt', 'desc'))
      const snapshot = await getDocs(q)
      
      const templatesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as EmailTemplate[]
      
      setTemplates(templatesData)
    } catch (error) {
      console.error('템플릿 불러오기 실패:', error)
      toast({
        title: "오류",
        description: "템플릿을 불러오는데 실패했습니다.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const saveCurrentTemplate = async () => {
    if (!user || !saveForm.name.trim()) {
      toast({
        title: "입력 오류",
        description: "템플릿 이름을 입력해주세요.",
        variant: "destructive"
      })
      return
    }

    try {
      const templateData: Omit<EmailTemplate, 'id'> = {
        name: saveForm.name.trim(),
        description: saveForm.description.trim(),
        content: currentTemplate,
        category,
        isHtml: currentTemplate.includes('<!DOCTYPE html') || currentTemplate.includes('<html'),
        isFavorite: saveForm.isFavorite,
        variables,
        createdAt: serverTimestamp(),
        createdBy: user.uid
      }

      await addDoc(collection(db, 'emailTemplates'), templateData)
      
      await fetchTemplates()
      setIsSaveOpen(false)
      setSaveForm({ name: '', description: '', isFavorite: false })
      
      toast({
        title: "저장 완료",
        description: "템플릿이 라이브러리에 저장되었습니다."
      })
    } catch (error) {
      console.error('템플릿 저장 실패:', error)
      toast({
        title: "저장 실패",
        description: "템플릿 저장에 실패했습니다.",
        variant: "destructive"
      })
    }
  }

  const deleteTemplate = async (templateId: string) => {
    try {
      await deleteDoc(doc(db, 'emailTemplates', templateId))
      await fetchTemplates()
      
      toast({
        title: "삭제 완료",
        description: "템플릿이 삭제되었습니다."
      })
    } catch (error) {
      console.error('템플릿 삭제 실패:', error)
      toast({
        title: "삭제 실패",
        description: "템플릿 삭제에 실패했습니다.",
        variant: "destructive"
      })
    }
  }

  const toggleFavorite = async (template: EmailTemplate) => {
    try {
      await updateDoc(doc(db, 'emailTemplates', template.id), {
        isFavorite: !template.isFavorite
      })
      await fetchTemplates()
    } catch (error) {
      console.error('즐겨찾기 업데이트 실패:', error)
    }
  }

  const copyTemplate = (content: string) => {
    navigator.clipboard.writeText(content)
    toast({
      title: "복사 완료",
      description: "템플릿이 클립보드에 복사되었습니다."
    })
  }

  const categoryTemplates = templates.filter(t => t.category === category || t.category === 'custom')
  const favoriteTemplates = categoryTemplates.filter(t => t.isFavorite)

  return (
    <div className="space-y-4">
      {/* 저장된 템플릿 라이브러리 */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">
            <Save className="h-4 w-4 mr-2" />
            저장된 템플릿 ({categoryTemplates.length})
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>이메일 템플릿 라이브러리</DialogTitle>
            <DialogDescription>
              저장된 템플릿을 선택하거나 현재 템플릿을 저장할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* 즐겨찾기 템플릿 */}
            {favoriteTemplates.length > 0 && (
              <div>
                <h3 className="flex items-center gap-2 font-semibold mb-3">
                  <Star className="h-4 w-4 text-yellow-500" />
                  즐겨찾기
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {favoriteTemplates.map((template) => (
                    <Card key={template.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">{template.name}</CardTitle>
                          <div className="flex items-center gap-1">
                            <Badge variant={template.isHtml ? "default" : "secondary"} className="text-xs">
                              {template.isHtml ? 'HTML' : 'TEXT'}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleFavorite(template)}
                              className="h-6 w-6 p-0"
                            >
                              <Star className="h-3 w-3 text-yellow-500 fill-current" />
                            </Button>
                          </div>
                        </div>
                        {template.description && (
                          <p className="text-xs text-muted-foreground">{template.description}</p>
                        )}
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              onTemplateSelect(template.content)
                              setIsOpen(false)
                              toast({
                                title: "템플릿 적용",
                                description: `"${template.name}" 템플릿이 적용되었습니다.`
                              })
                            }}
                            className="flex-1"
                          >
                            <Download className="h-3 w-3 mr-1" />
                            적용
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPreviewTemplate(template)}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyTemplate(template.content)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* 전체 템플릿 */}
            <div>
              <h3 className="font-semibold mb-3">
                전체 템플릿 ({categoryTemplates.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {categoryTemplates.map((template) => (
                  <Card key={template.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{template.name}</CardTitle>
                        <div className="flex items-center gap-1">
                          <Badge variant={template.isHtml ? "default" : "secondary"} className="text-xs">
                            {template.isHtml ? 'HTML' : 'TEXT'}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleFavorite(template)}
                            className="h-6 w-6 p-0"
                          >
                            {template.isFavorite ? (
                              <Star className="h-3 w-3 text-yellow-500 fill-current" />
                            ) : (
                              <StarOff className="h-3 w-3 text-gray-400" />
                            )}
                          </Button>
                        </div>
                      </div>
                      {template.description && (
                        <p className="text-xs text-muted-foreground">{template.description}</p>
                      )}
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            onTemplateSelect(template.content)
                            setIsOpen(false)
                            toast({
                              title: "템플릿 적용",
                              description: `"${template.name}" 템플릿이 적용되었습니다.`
                            })
                          }}
                          className="flex-1"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          적용
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPreviewTemplate(template)}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyTemplate(template.content)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        {template.createdBy === user?.uid && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>템플릿 삭제</AlertDialogTitle>
                                <AlertDialogDescription>
                                  "{template.name}" 템플릿을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>취소</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteTemplate(template.id)}>
                                  삭제
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 현재 템플릿 저장 */}
      <Dialog open={isSaveOpen} onOpenChange={setIsSaveOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">
            <Save className="h-4 w-4 mr-2" />
            현재 템플릿 저장
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>템플릿 저장</DialogTitle>
            <DialogDescription>
              현재 작성된 템플릿을 라이브러리에 저장합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">템플릿 이름 *</Label>
              <Input
                id="template-name"
                value={saveForm.name}
                onChange={(e) => setSaveForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="예: 고급 배송완료 템플릿"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-description">설명</Label>
              <Textarea
                id="template-description"
                value={saveForm.description}
                onChange={(e) => setSaveForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="템플릿에 대한 간단한 설명을 입력하세요"
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="favorite"
                checked={saveForm.isFavorite}
                onChange={(e) => setSaveForm(prev => ({ ...prev, isFavorite: e.target.checked }))}
                className="h-4 w-4"
              />
              <Label htmlFor="favorite">즐겨찾기에 추가</Label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsSaveOpen(false)}>
              취소
            </Button>
            <Button onClick={saveCurrentTemplate}>
              저장
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 템플릿 미리보기 */}
      {previewTemplate && (
        <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{previewTemplate.name}</DialogTitle>
              <DialogDescription>
                {previewTemplate.description}
              </DialogDescription>
            </DialogHeader>
            <div className="border rounded-md p-4 bg-gray-50 max-h-[400px] overflow-auto">
              {previewTemplate.isHtml ? (
                <iframe
                  srcDoc={previewTemplate.content}
                  className="w-full h-[400px] border-0"
                  title="템플릿 미리보기"
                />
              ) : (
                <pre className="whitespace-pre-wrap text-sm">
                  {previewTemplate.content}
                </pre>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
