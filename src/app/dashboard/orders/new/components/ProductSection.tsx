import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Plus, Search } from "lucide-react";
import { Product } from "@/hooks/use-products";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface CategoryData {
    name: string;
    products: Product[];
}

interface ProductSectionProps {
    categories: CategoryData[];
    allProducts: Product[]; // Full list of products for the branch
    onAddProduct: (product: Product) => void;
    onOpenCustomProductDialog: () => void;
    onTabChange?: (tab: string) => void;
}

export function ProductSection({
    categories,
    allProducts,
    onAddProduct,
    onOpenCustomProductDialog,
    onTabChange
}: ProductSectionProps) {
    const [activeTab, setActiveTab] = useState(categories[0]?.name || "");
    const [searchTerm, setSearchTerm] = useState("");

    // Update active tab if categories change and current tab is invalid
    React.useEffect(() => {
        if (categories.length > 0 && (!activeTab || !categories.find(c => c.name === activeTab))) {
            setActiveTab(categories[0].name);
        }
    }, [categories, activeTab]);

    const filteredAllProducts = allProducts.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());

        let matchesCategory = true;
        if (activeTab) {
            const mCat = p.mainCategory || "";
            const midCat = p.midCategory || "";
            const name = p.name || "";

            if (activeTab === '화환') {
                matchesCategory = mCat.includes('화환') || midCat.includes('화환') || name.includes('화환') || name.includes('근조') || name.includes('축하');
            } else if (activeTab === '동서양란') {
                matchesCategory = mCat.includes('란') || midCat.includes('란') || name.includes('란') || mCat.includes('난') || midCat.includes('난') || name.includes('난') || name.includes('동양란') || name.includes('서양란') || name.includes('호접란');
            } else if (activeTab === '플랜트') {
                matchesCategory = mCat.includes('플랜트') || mCat.includes('관엽') || mCat.includes('공기정화');
            } else {
                matchesCategory = mCat.includes(activeTab) || midCat.includes(activeTab) || name.includes(activeTab);
            }
        }

        return matchesSearch && matchesCategory;
    });

    const ProductGrid = ({ products }: { products: Product[] }) => {
        if (products.length === 0) {
            return <div className="text-center py-8 text-muted-foreground text-sm">등록된 상품이 없습니다.</div>;
        }
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {products.map((product) => (
                    <Button
                        key={product.id}
                        variant="outline"
                        className="h-auto py-3 min-h-[5rem] flex flex-col items-center justify-center space-y-1 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all shadow-sm"
                        onClick={() => onAddProduct(product)}
                        disabled={product.stock <= 0}
                    >
                        <span className="font-bold text-sm text-center leading-tight break-keep line-clamp-2 text-foreground group-hover:text-primary">
                            {product.name}
                        </span>
                        <span className="text-sm font-bold text-primary">
                            {product.price.toLocaleString()}원
                        </span>
                        {product.stock <= 0 && <Badge variant="destructive" className="text-[10px] h-5 px-1 mt-1">품절</Badge>}
                        {product.stock > 0 && <span className="text-[10px] text-muted-foreground">재고: {product.stock}</span>}
                    </Button>
                ))}
            </div>
        );
    };

    return (
        <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-semibold">상품 선택</CardTitle>
                <Button variant="outline" size="sm" onClick={onOpenCustomProductDialog}>
                    <Plus className="w-4 h-4 mr-1" />
                    직접 입력
                </Button>
            </CardHeader>
            <CardContent>
                <Tabs value={activeTab} onValueChange={(val) => {
                    setActiveTab(val);
                    onTabChange?.(val);
                }} className="w-full">
                    <ScrollArea className="w-full whitespace-nowrap rounded-md border bg-muted/50 p-1 mb-4">
                        <TabsList className="inline-flex w-max min-w-full justify-start h-9 p-0 bg-transparent">
                            {categories.map((cat) => (
                                <TabsTrigger
                                    key={cat.name}
                                    value={cat.name}
                                    className="data-[state=active]:bg-white data-[state=active]:shadow-sm px-4"
                                >
                                    {cat.name}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>

                    {categories.map((cat) => (
                        <TabsContent key={cat.name} value={cat.name} className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-medium text-muted-foreground">{cat.name} 판매 순위 상품</h4>
                                </div>
                                <ProductGrid products={cat.products} />
                            </div>
                        </TabsContent>
                    ))}
                </Tabs>

                <div className="mt-6 pt-4 border-t space-y-3">
                    <Label>상품 전체 검색 및 선택</Label>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="상품명 검색..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select onValueChange={(val) => {
                            const p = allProducts.find(prod => prod.docId === val);
                            if (p) {
                                onAddProduct(p);
                                setSearchTerm("");
                            }
                        }}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="상품 목록 선택" />
                            </SelectTrigger>
                            <SelectContent>
                                {filteredAllProducts.slice(0, 50).map(p => (
                                    <SelectItem key={p.docId} value={p.docId} disabled={p.stock <= 0}>
                                        {p.name} ({p.price.toLocaleString()}원)
                                    </SelectItem>
                                ))}
                                {filteredAllProducts.length > 50 && (
                                    <div className="p-2 text-xs text-center text-muted-foreground">
                                        검색 결과가 너무 많습니다. 검색어를 입력해주세요.
                                    </div>
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                    {searchTerm && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                            {filteredAllProducts.slice(0, 6).map(p => (
                                <Button
                                    key={p.id}
                                    variant="ghost"
                                    className="justify-start h-auto py-2 text-left"
                                    onClick={() => {
                                        onAddProduct(p);
                                        setSearchTerm("");
                                    }}
                                    disabled={p.stock <= 0}
                                >
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">{p.name}</span>
                                        <span className="text-xs text-muted-foreground">{p.price.toLocaleString()}원</span>
                                    </div>
                                </Button>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
