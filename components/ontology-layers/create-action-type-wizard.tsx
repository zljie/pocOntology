"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useOntologyStore, useSelectionStore, useUIStore } from "@/stores";
import { toPascalCase, isPascalCase } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface CreateActionTypeWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateActionTypeWizard({ open, onOpenChange }: CreateActionTypeWizardProps) {
  const { objectTypes, addActionType } = useOntologyStore();
  const { selectActionType } = useSelectionStore();
  const { openRightPanel } = useUIStore();
  
  const [step, setStep] = useState(1);
  
  // Step 1: Selection
  const [targetType, setTargetType] = useState<string>("Object"); // Object, Link, Function...
  const [selectedObjectId, setSelectedObjectId] = useState<string>("");
  const [actionOperation, setActionOperation] = useState<string>("Modify object(s)");
  
  // Step 2: Metadata (derived mostly from step 1)
  const [displayName, setDisplayName] = useState("");
  const [apiName, setApiName] = useState("");
  const [description, setDescription] = useState("");

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    setApiName(toPascalCase(value));
  };

  const isStep1Valid = selectedObjectId && actionOperation;
  const isStep2Valid = displayName.trim() && apiName.trim() && isPascalCase(apiName);

  const handleNext = () => {
    if (step === 1 && isStep1Valid) {
      // pre-fill step 2
      const obj = objectTypes.find(o => o.id === selectedObjectId);
      if (obj && !displayName) {
        let defaultName = "";
        if (actionOperation === "Create object") defaultName = `Create ${obj.displayName}`;
        else if (actionOperation === "Modify object(s)") defaultName = `Modify ${obj.displayName}`;
        else if (actionOperation === "Delete object(s)") defaultName = `Delete ${obj.displayName}`;
        else defaultName = `Action on ${obj.displayName}`;
        
        setDisplayName(defaultName);
        setApiName(toPascalCase(defaultName));
      }
      setStep(2);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = () => {
    if (!isStep2Valid) return;
    
    // Auto generate some input parameters based on operation and object
    // If modify or create, we could add parameters for properties, but let's leave it to the editor.
    
    const newActionType = addActionType({
      displayName,
      apiName,
      description,
      affectedObjectTypeIds: [selectedObjectId],
      affectedLinkTypeIds: [],
      inputParameters: [], // To be configured in the editor
      outputProperties: [],
      visibility: "PROJECT",
      layer: "KINETIC",
    });
    
    // Reset state
    setStep(1);
    setTargetType("Object");
    setSelectedObjectId("");
    setActionOperation("Modify object(s)");
    setDisplayName("");
    setApiName("");
    setDescription("");
    
    onOpenChange(false);
    
    // Automatically open the new action type in the right panel for further form configuration
    if (newActionType && newActionType.id) {
      selectActionType(newActionType.id);
      openRightPanel();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v) {
        setStep(1);
      }
      onOpenChange(v);
    }}>
      <DialogContent className="bg-[#1a1a18] border-[#2d2d2d] text-white max-w-3xl min-h-[500px] flex flex-col p-0 overflow-hidden">
        <div className="flex flex-1 h-full">
          {/* Left Sidebar Steps */}
          <div className="w-48 bg-[#111111] border-r border-[#2d2d2d] p-4 flex flex-col gap-2">
            <h3 className="font-semibold text-sm mb-4 px-2">创建操作类型</h3>
            <div className={`px-3 py-2 text-sm rounded-md flex items-center gap-2 ${step === 1 ? 'bg-[#3B82F6]/20 text-[#3B82F6] font-medium' : 'text-[#a0a0a0]'}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${step === 1 ? 'bg-[#3B82F6] text-white' : 'bg-[#2d2d2d]'}`}>1</div>
              操作类型
            </div>
            <div className={`px-3 py-2 text-sm rounded-md flex items-center gap-2 ${step === 2 ? 'bg-[#3B82F6]/20 text-[#3B82F6] font-medium' : 'text-[#a0a0a0]'}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${step === 2 ? 'bg-[#3B82F6] text-white' : 'bg-[#2d2d2d]'}`}>2</div>
              元数据
            </div>
            <div className="px-3 py-2 text-sm rounded-md flex items-center gap-2 text-[#6b6b6b]">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs bg-[#1a1a1a]">3</div>
              表单配置
            </div>
          </div>
          
          {/* Right Content */}
          <div className="flex-1 flex flex-col p-6">
            {step === 1 && (
              <div className="flex-1 space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-1">选择要配置的操作类型</h2>
                  <p className="text-sm text-[#a0a0a0]">通过配置可执行的操作，让用户对本体数据进行一致的变更。</p>
                </div>
                
                <Tabs value={targetType} onValueChange={setTargetType} className="w-full">
                  <TabsList className="bg-transparent border-b border-[#2d2d2d] rounded-none p-0 h-auto justify-start w-full gap-6">
                    {['对象', '链接', '函数', 'Webhook', '界面', '通知'].map((t, idx) => (
                      <TabsTrigger 
                        key={t}
                        value={["Object", "Link", "Function", "Webhook", "Interface", "Notification"][idx]}
                        className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#3B82F6] data-[state=active]:shadow-none rounded-none px-0 py-2"
                      >
                        {t}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  
                  <TabsContent value="Object" className="pt-6 space-y-6">
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">对象类型</Label>
                      <Select value={selectedObjectId} onValueChange={setSelectedObjectId}>
                        <SelectTrigger className="bg-[#0d0d0d] border-[#2d2d2d] w-full">
                          <SelectValue placeholder="请选择对象类型" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1a18] border-[#2d2d2d] text-white">
                          {objectTypes.map(ot => (
                            <SelectItem key={ot.id} value={ot.id}>{ot.displayName} ({ot.apiName})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">对象操作</Label>
                      <RadioGroup value={actionOperation} onValueChange={setActionOperation} className="space-y-3">
                        <div className="flex items-start space-x-3 border border-[#2d2d2d] p-3 rounded-md bg-[#161614] hover:bg-[#1f1f1c] cursor-pointer">
                          <RadioGroupItem value="Create object" id="create-obj" className="mt-1" />
                          <div>
                            <Label htmlFor="create-obj" className="font-medium cursor-pointer">创建对象</Label>
                            <p className="text-xs text-[#a0a0a0]">配置一个用于新增对象实例的操作类型</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3 border border-[#2d2d2d] p-3 rounded-md bg-[#161614] hover:bg-[#1f1f1c] cursor-pointer">
                          <RadioGroupItem value="Modify object(s)" id="modify-obj" className="mt-1" />
                          <div>
                            <Label htmlFor="modify-obj" className="font-medium cursor-pointer">修改对象</Label>
                            <p className="text-xs text-[#a0a0a0]">配置一个用于编辑既有对象实例的操作类型</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3 border border-[#2d2d2d] p-3 rounded-md bg-[#161614] hover:bg-[#1f1f1c] cursor-pointer">
                          <RadioGroupItem value="Modify or create object" id="modify-create-obj" className="mt-1" />
                          <div>
                            <Label htmlFor="modify-create-obj" className="font-medium cursor-pointer">修改或创建对象</Label>
                            <p className="text-xs text-[#a0a0a0]">若对象实例存在则修改，否则创建新实例</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3 border border-[#2d2d2d] p-3 rounded-md bg-[#161614] hover:bg-[#1f1f1c] cursor-pointer">
                          <RadioGroupItem value="Delete object(s)" id="delete-obj" className="mt-1" />
                          <div>
                            <Label htmlFor="delete-obj" className="font-medium cursor-pointer">删除对象</Label>
                            <p className="text-xs text-[#a0a0a0]">删除一个或多个对象实例</p>
                          </div>
                        </div>
                      </RadioGroup>
                    </div>
                  </TabsContent>
                  
                  {targetType !== "Object" && (
                    <div className="pt-10 flex flex-col items-center justify-center text-[#6b6b6b]">
                      <p>当前模拟器暂不支持此类操作类型。</p>
                      <p className="text-xs mt-2">请先选择“对象”继续。</p>
                    </div>
                  )}
                </Tabs>
              </div>
            )}
            
            {step === 2 && (
              <div className="flex-1 space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-1">操作类型元数据</h2>
                  <p className="text-sm text-[#a0a0a0]">填写该操作类型的基本信息。</p>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">显示名称</Label>
                    <Input 
                      value={displayName} 
                      onChange={(e) => handleDisplayNameChange(e.target.value)} 
                      className="bg-[#0d0d0d] border-[#2d2d2d]" 
                      placeholder="例如：指派员工角色"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">API 名称 <span className="text-xs text-[#6b6b6b]">(PascalCase)</span></Label>
                    <Input 
                      value={apiName} 
                      onChange={(e) => setApiName(e.target.value)} 
                      className="bg-[#0d0d0d] border-[#2d2d2d] font-mono" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">描述（可选）</Label>
                    <Textarea 
                      value={description} 
                      onChange={(e) => setDescription(e.target.value)} 
                      className="bg-[#0d0d0d] border-[#2d2d2d] min-h-[100px]" 
                      placeholder="描述该操作会做什么..."
                    />
                  </div>
                </div>
              </div>
            )}
            
            {/* Footer buttons */}
            <div className="mt-auto pt-6 border-t border-[#2d2d2d] flex justify-between">
              <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-[#a0a0a0]">取消</Button>
              <div className="space-x-2">
                {step > 1 && (
                  <Button variant="outline" onClick={handleBack} className="border-[#2d2d2d] text-white">上一步</Button>
                )}
                {step === 1 ? (
                  <Button onClick={handleNext} disabled={!isStep1Valid} className="bg-[#3B82F6] hover:bg-[#2563EB] text-white">下一步</Button>
                ) : (
                  <Button onClick={handleSubmit} disabled={!isStep2Valid} className="bg-[#10B981] hover:bg-[#059669] text-white">创建</Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
