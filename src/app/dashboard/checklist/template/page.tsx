"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  CheckSquare, 
  Calendar, 
  CalendarDays, 
  Building, 
  Plus,
  Trash2,
  GripVertical,
  Save,
  ArrowLeft
} from "lucide-react";
import { useChecklist } from "@/hooks/use-checklist";
import { useAuth } from "@/hooks/use-auth";
import { useUserRole } from "@/hooks/use-user-role";
import { useBranches } from "@/hooks/use-branches";
import { ChecklistTemplate, ChecklistItem } from "@/types/checklist";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ChecklistTemplatePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { userRole, isHQManager } = useUserRole();
  const { branches } = useBranches();
  const { getTemplate, updateTemplate, createDefaultTemplate } = useChecklist();
  const { toast } = useToast();
  
  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editableItems, setEditableItems] = useState<ChecklistItem[]>([]);
  const [newItem, setNewItem] = useState({
    title: '',
    description: '',
    required: false,
    category: 'daily'
  });
  const [selectedCategory, setSelectedCategory] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [isEditingAllBranches, setIsEditingAllBranches] = useState(false);

  // 본사 관리자가 아닌 경우 사용자의 지점으로 설정
  const defaultBranchId = userRole?.branchId || user?.franchise || '';
  const branchId = isHQManager ? selectedBranchId || defaultBranchId : defaultBranchId;

  useEffect(() => {
    const loadTemplate = async () => {
      // 본사 관리자가 지점을 선택하지 않았으면 기본 지점으로 설정
      const targetBranchId = selectedBranchId || defaultBranchId;
      if (!targetBranchId) return;
      
      try {
        setLoading(true);
        
                 if (isEditingAllBranches) {
           // 전체 지점 편집 시 첫 번째 지점의 템플릿을 기준으로 보여줌
           const branchBranches = branches;
           if (branchBranches.length > 0) {
             const firstBranch = branchBranches[0];
             const templateData = await getTemplate(firstBranch.id);
             if (templateData) {
               const allBranchesTemplate: ChecklistTemplate = {
                 ...templateData,
                 id: 'all_branches_template',
                 name: '전체 지점 공통 템플릿',
                 branchId: 'all'
               };
               setTemplate(allBranchesTemplate);
               setEditableItems(templateData.items);
             } else {
               // 첫 번째 지점에 템플릿이 없으면 기본 템플릿 생성
               const templateId = await createDefaultTemplate(firstBranch.id);
               const newTemplate = await getTemplate(firstBranch.id);
               if (newTemplate) {
                 const allBranchesTemplate: ChecklistTemplate = {
                   ...newTemplate,
                   id: 'all_branches_template',
                   name: '전체 지점 공통 템플릿',
                   branchId: 'all'
                 };
                 setTemplate(allBranchesTemplate);
                 setEditableItems(newTemplate.items);
               }
             }
           }
         } else {
           // 개별 지점 템플릿 로드
           const templateData = await getTemplate(targetBranchId);
           if (templateData) {
             setTemplate(templateData);
             setEditableItems(templateData.items);
           } else {
             // 템플릿이 없으면 기본 템플릿 생성
             const templateId = await createDefaultTemplate(targetBranchId);
             const newTemplate = await getTemplate(targetBranchId);
             if (newTemplate) {
               setTemplate(newTemplate);
               setEditableItems(newTemplate.items);
             }
           }
         }
      } catch (error) {
        console.error('Error loading template:', error);
        toast({
          title: "오류",
          description: "템플릿을 불러오는 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadTemplate();
  }, [selectedBranchId, isEditingAllBranches, getTemplate, createDefaultTemplate, toast, defaultBranchId]);

  // 지점 변경 핸들러
  const handleBranchChange = useCallback((newBranchId: string) => {
    setSelectedBranchId(newBranchId);
    setIsEditingAllBranches(newBranchId === 'all');
    // 템플릿과 편집 가능한 항목들을 초기화
    setTemplate(null);
    setEditableItems([]);
  }, []);

  const handleAddItem = useCallback(() => {
    if (!newItem.title.trim()) return;
    
    const item: ChecklistItem = {
      id: `temp_${Date.now()}`,
      title: newItem.title,
      description: newItem.description,
      required: newItem.required,
      category: newItem.category,
      order: editableItems.filter(i => i.category === newItem.category).length
    };
    
    setEditableItems(prev => [...prev, item]);
    setNewItem({
      title: '',
      description: '',
      required: false,
      category: 'daily'
    });
  }, [newItem, editableItems]);

  const handleRemoveItem = useCallback((itemId: string) => {
    setItemToDelete(itemId);
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (itemToDelete) {
      setEditableItems(prev => prev.filter(item => item.id !== itemToDelete));
      setItemToDelete(null);
    }
    setDeleteDialogOpen(false);
  }, [itemToDelete]);

  const handleUpdateItem = useCallback((itemId: string, field: keyof ChecklistItem, value: any) => {
    setEditableItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, [field]: value } : item
    ));
  }, []);

  const handleSaveTemplate = useCallback(async () => {
    if (!template) return;
    
    try {
      setSaving(true);
      const updatedTemplate = {
        ...template,
        items: editableItems
      };
      
             if (isEditingAllBranches) {
         // 모든 지점에 템플릿 적용
         const branchBranches = branches;
        const updatePromises = branchBranches.map(async (branch) => {
          try {
            const branchTemplate = await getTemplate(branch.id);
            if (branchTemplate) {
              await updateTemplate(branchTemplate.id, updatedTemplate);
            } else {
              // 템플릿이 없으면 새로 생성
              await createDefaultTemplate(branch.id);
              const newTemplate = await getTemplate(branch.id);
              if (newTemplate) {
                await updateTemplate(newTemplate.id, updatedTemplate);
              }
            }
          } catch (error) {
            console.error(`Error updating template for branch ${branch.name}:`, error);
          }
        });
        
        await Promise.all(updatePromises);
        
        toast({
          title: "저장 완료",
          description: `모든 지점(${branchBranches.length}개)의 템플릿이 성공적으로 업데이트되었습니다.`,
        });
      } else {
        // 단일 지점 템플릿 저장
        await updateTemplate(template.id, updatedTemplate);
        setTemplate(updatedTemplate);
        
        toast({
          title: "저장 완료",
          description: "템플릿이 성공적으로 저장되었습니다.",
        });
      }
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: "오류",
        description: "템플릿 저장 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }, [template, editableItems, updateTemplate, toast, isEditingAllBranches, branches, getTemplate, createDefaultTemplate]);

  const getCategoryIcon = useCallback((category: string) => {
    switch (category) {
      case 'daily':
        return <Calendar className="h-4 w-4" />;
      case 'weekly':
        return <CalendarDays className="h-4 w-4" />;
      case 'monthly':
        return <Building className="h-4 w-4" />;
      default:
        return <CheckSquare className="h-4 w-4" />;
    }
  }, []);

  const getCategoryItems = useCallback(() => {
    return editableItems.filter(item => item.category === selectedCategory);
  }, [editableItems, selectedCategory]);

  if (loading) {
    return (
      <div className="space-y-8">
        <PageHeader 
          title="체크리스트 템플릿 편집" 
          description="체크리스트 템플릿을 관리하세요." 
        />
        <div className="animate-pulse space-y-4">
          <Card>
            <CardHeader>
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 bg-gray-200 rounded"></div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader 
        title="체크리스트 템플릿 편집" 
        description="체크리스트 템플릿을 관리하세요." 
      />

      {/* 본사 관리자용 지점 선택 */}
      {isHQManager && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              지점 선택
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="space-y-2 flex-1">
                <Label htmlFor="branch-select">편집할 지점 선택</Label>
                                 <Select value={selectedBranchId} onValueChange={handleBranchChange}>
                   <SelectTrigger id="branch-select">
                     <SelectValue placeholder="지점을 선택하세요" />
                   </SelectTrigger>
                   <SelectContent>
                                           <SelectItem value="all" className="font-semibold text-blue-600">
                        📋 전체 지점 (모든 지점에 적용)
                      </SelectItem>
                      <SelectItem value="separator" disabled className="text-gray-400">
                        ────────────────
                      </SelectItem>
                     {branches.map(branch => (
                       <SelectItem key={branch.id} value={branch.id}>
                         {branch.name}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
              </div>
                             {selectedBranchId && (
                 <div className="text-sm text-muted-foreground">
                   {isEditingAllBranches ? (
                     <span className="text-blue-600 font-medium">
                       전체 지점 ({branches.length}개 지점)
                     </span>
                   ) : (
                     <span>선택된 지점: {branches.find(b => b.id === selectedBranchId)?.name}</span>
                   )}
                 </div>
               )}
            </div>
                         {!selectedBranchId && (
               <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                 <p className="text-sm text-blue-800">
                   편집할 지점을 선택해주세요. 
                   <br />• <strong>전체 지점</strong>: 모든 지점의 템플릿을 한 번에 수정할 수 있습니다.
                   <br />• <strong>개별 지점</strong>: 특정 지점의 템플릿만 수정할 수 있습니다.
                 </p>
               </div>
             )}
          </CardContent>
        </Card>
      )}

      {/* 지점이 선택되었거나 본사 관리자가 아닌 경우에만 표시 */}
      {(!isHQManager || selectedBranchId) && (
        <>
          {/* 카테고리 선택 */}
          <Card>
            <CardHeader>
              <CardTitle>카테고리별 항목 관리</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-6">
                {(['daily', 'weekly', 'monthly'] as const).map((category) => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? "default" : "outline"}
                    onClick={() => setSelectedCategory(category)}
                    className="flex items-center gap-2"
                  >
                    {getCategoryIcon(category)}
                    {category === 'daily' && '일일'}
                    {category === 'weekly' && '주간'}
                    {category === 'monthly' && '월간'}
                    <Badge variant="secondary">
                      {editableItems.filter(item => item.category === category).length}
                    </Badge>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* 지점이 선택되었거나 본사 관리자가 아닌 경우에만 표시 */}
      {(!isHQManager || selectedBranchId) && (
        <>
          {/* 새 항목 추가 */}
          <Card>
            <CardHeader>
              <CardTitle>새 항목 추가</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <Label htmlFor="newItemTitle">항목 제목</Label>
                  <Input
                    id="newItemTitle"
                    value={newItem.title}
                    onChange={(e) => setNewItem(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="항목 제목을 입력하세요"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newItemDescription">항목 설명</Label>
                  <Input
                    id="newItemDescription"
                    value={newItem.description}
                    onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="항목 설명을 입력하세요"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="newItemRequired"
                    checked={newItem.required}
                    onCheckedChange={(checked) => setNewItem(prev => ({ ...prev, required: checked as boolean }))}
                  />
                  <Label htmlFor="newItemRequired">필수 항목</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Label>카테고리:</Label>
                  <Select
                    value={newItem.category}
                    onValueChange={(value: 'daily' | 'weekly' | 'monthly') => 
                      setNewItem(prev => ({ ...prev, category: value }))
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">일일</SelectItem>
                      <SelectItem value="weekly">주간</SelectItem>
                      <SelectItem value="monthly">월간</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddItem} disabled={!newItem.title.trim()}>
                  <Plus className="h-4 w-4 mr-2" />
                  항목 추가
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* 지점이 선택되었거나 본사 관리자가 아닌 경우에만 표시 */}
      {(!isHQManager || selectedBranchId) && (
        <>
          {/* 현재 카테고리 항목들 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {getCategoryIcon(selectedCategory)}
                {selectedCategory === 'daily' && '일일'} 
                {selectedCategory === 'weekly' && '주간'} 
                {selectedCategory === 'monthly' && '월간'} 항목들
                <Badge variant="secondary">
                  {getCategoryItems().length}개
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {getCategoryItems().map((item) => (
                  <div key={item.id} className="flex items-start gap-4 p-4 border rounded-lg bg-white">
                    <GripVertical className="h-5 w-5 text-gray-400 mt-2" />
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <Input
                          value={item.title}
                          onChange={(e) => handleUpdateItem(item.id, 'title', e.target.value)}
                          placeholder="항목 제목"
                          className="flex-1"
                        />
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            checked={item.required}
                            onCheckedChange={(checked) => handleUpdateItem(item.id, 'required', checked)}
                          />
                          <Label className="text-sm">필수</Label>
                        </div>
                      </div>
                      <Input
                        value={item.description}
                        onChange={(e) => handleUpdateItem(item.id, 'description', e.target.value)}
                        placeholder="항목 설명 (선택사항)"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {getCategoryItems().length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    이 카테고리에 항목이 없습니다. 새 항목을 추가해보세요.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* 액션 버튼 */}
      <div className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          뒤로 가기
        </Button>
                 {(!isHQManager || selectedBranchId) && (
           <div className="flex items-center gap-4">
             <div className="text-sm text-muted-foreground">
                                {isEditingAllBranches ? (
                   <span className="text-blue-600 font-medium">
                     전체 지점 편집 중 ({branches.length}개 지점)
                   </span>
                 ) : (
                 <span>편집 중: {branches.find(b => b.id === branchId)?.name || '지점 없음'}</span>
               )}
             </div>
             <Button 
               onClick={handleSaveTemplate}
               disabled={saving || !selectedBranchId}
             >
               <Save className="h-4 w-4 mr-2" />
               {saving ? '저장 중...' : (isEditingAllBranches ? '전체 지점 저장' : '템플릿 저장')}
             </Button>
           </div>
         )}
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>항목 삭제</DialogTitle>
            <DialogDescription>
              정말로 이 항목을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

