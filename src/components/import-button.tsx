
"use client";
import React, { useState } from "react";
import { Upload } from "lucide-react";
import { Button, ButtonProps } from "./ui/button";
import { ImportDialog } from "./import-dialog";
interface ImportButtonProps extends Omit<ButtonProps, 'children'> {
    resourceName?: string;
    onImport: (data: any[]) => Promise<void>;
    children?: React.ReactNode;
    templateData?: any[];
    fileName?: string;
}
export function ImportButton({ resourceName = "데이터", onImport, children, templateData, fileName, ...props }: ImportButtonProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    return (
        <>
            <Button {...props} onClick={() => setIsDialogOpen(true)} size="sm">
                {children || (
                    <>
                        <Upload className="mr-2 h-4 w-4" />
                        가져오기
                    </>
                )}
            </Button>
            <ImportDialog
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                resourceName={resourceName}
                onImport={onImport}
            />
        </>
    )
}
