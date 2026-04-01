"use client";

import React, { useState } from "react";
import { X, Settings, Database, Plus, Trash2, Edit2, Code, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useOntologyStore, useSelectionStore, useUIStore } from "@/stores";
import { Property, ActionType, PropertyBaseType } from "@/lib/types/ontology";
import { toPascalCase } from "@/lib/utils";

export function ActionTypeEditor() {
  const { actionTypes, updateActionType } = useOntologyStore();
  const { selectedActionTypeId, selectActionType } = useSelectionStore();
  const { closeRightPanel } = useUIStore();
  
  const [activeTab, setActiveTab] = useState("form");
  const [editingParam, setEditingParam] = useState<Property | null>(null);

  const selectedActionType = actionTypes.find((at) => at.id === selectedActionTypeId);

  if (!selectedActionType) return null;

  const handleClose = () => {
    closeRightPanel();
    selectActionType(null);
  };

  const addParameter = () => {
    const newParam: Property = {
      id: `param-${Date.now()}`,
      apiName: `newParam${selectedActionType.inputParameters.length + 1}`,
      displayName: "新参数",
      baseType: "STRING",
      visibility: "NORMAL",
      required: true,
    };
    
    updateActionType(selectedActionType.id, {
      inputParameters: [...(selectedActionType.inputParameters || []), newParam]
    });
  };

  const removeParameter = (id: string) => {
    updateActionType(selectedActionType.id, {
      inputParameters: selectedActionType.inputParameters.filter(p => p.id !== id)
    });
  };

  const updateParameter = (updatedParam: Property) => {
    updateActionType(selectedActionType.id, {
      inputParameters: selectedActionType.inputParameters.map(p => 
        p.id === updatedParam.id ? updatedParam : p
      )
    });
    setEditingParam(null);
  };

  const generatePayloadPreview = (parameters: Property[]) => {
    const payload: Record<string, any> = {};
    if (!parameters || parameters.length === 0) return "{\n  // 无输入参数\n}";
    
    parameters.forEach(p => {
      let valPreview: any = "";
      switch (p.baseType) {
        case "STRING": valPreview = "string"; break;
        case "INTEGER": valPreview = 0; break;
        case "DOUBLE": valPreview = 0.0; break;
        case "BOOLEAN": valPreview = false; break;
        case "TIMESTAMP": valPreview = "2024-01-01T00:00:00Z"; break;
        default: valPreview = null;
      }
      
      // 添加注释说明
      const key = `${p.apiName}${p.required ? "" : "?"}`;
      payload[key] = valPreview;
    });

    // 手动拼接 JSON 字符串以支持注释
    let jsonStr = "{\n";
    parameters.forEach((p, idx) => {
      const isLast = idx === parameters.length - 1;
      let valPreview = "";
      switch (p.baseType) {
        case "STRING": valPreview = '"string"'; break;
        case "INTEGER": valPreview = "0"; break;
        case "DOUBLE": valPreview = "0.0"; break;
        case "BOOLEAN": valPreview = "false"; break;
        case "TIMESTAMP": valPreview = '"2024-01-01T00:00:00Z"'; break;
        default: valPreview = "null";
      }
      
      const key = `"${p.apiName}"`;
      const comment = `// ${p.displayName}${p.required ? " (必填)" : " (可选)"}`;
      jsonStr += `  ${key}: ${valPreview}${isLast ? "" : ","} ${comment}\n`;
    });
    jsonStr += "}";
    
    return jsonStr;
  };

  return (
    <div className="flex flex-col h-full bg-[#161614]">
      <div className="flex items-center justify-between p-4 border-b border-[#2d2d2d]">
        <div>
          <h2 className="text-sm font-semibold text-white">{selectedActionType.displayName}</h2>
          <span className="text-xs text-[#6b6b6b] font-mono">{selectedActionType.apiName}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-[#6b6b6b] hover:text-white" onClick={handleClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 overflow-hidden">
        <div className="px-4 pt-2 border-b border-[#2d2d2d]">
          <TabsList className="bg-transparent p-0 h-auto gap-4">
            <TabsTrigger value="config" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#10B981] data-[state=active]:shadow-none rounded-none px-0 py-2">
              <Settings className="w-3.5 h-3.5 mr-1" /> 基本配置
            </TabsTrigger>
            <TabsTrigger value="form" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#10B981] data-[state=active]:shadow-none rounded-none px-0 py-2">
              <FileText className="w-3.5 h-3.5 mr-1" /> 表单内容
            </TabsTrigger>
            <TabsTrigger value="preview" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#10B981] data-[state=active]:shadow-none rounded-none px-0 py-2">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> 表单预览
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4">
            <TabsContent value="config" className="m-0 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-[#6b6b6b]">显示名称</Label>
                  <Input 
                    value={selectedActionType.displayName} 
                    onChange={(e) => updateActionType(selectedActionType.id, { displayName: e.target.value })} 
                    className="bg-[#0d0d0d] border-[#2d2d2d]" 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-[#6b6b6b]">API 名称</Label>
                  <Input 
                    value={selectedActionType.apiName} 
                    onChange={(e) => updateActionType(selectedActionType.id, { apiName: e.target.value })} 
                    className="bg-[#0d0d0d] border-[#2d2d2d] font-mono text-xs" 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-[#6b6b6b]">描述</Label>
                  <Textarea 
                    value={selectedActionType.description || ""} 
                    onChange={(e) => updateActionType(selectedActionType.id, { description: e.target.value })} 
                    className="bg-[#0d0d0d] border-[#2d2d2d] min-h-[80px]" 
                  />
                </div>

                <div className="pt-4 border-t border-[#2d2d2d] space-y-4">
                  <h4 className="text-sm font-medium text-white">API 绑定设置</h4>
                  <div className="space-y-2">
                    <Label className="text-xs text-[#6b6b6b]">执行方式</Label>
                    <Select
                      value={selectedActionType.apiBinding?.mode || 'BUILTIN_UPDATE'}
                      onValueChange={(v) => updateActionType(selectedActionType.id, {
                        apiBinding: { ...selectedActionType.apiBinding, mode: v as any }
                      })}
                    >
                      <SelectTrigger className="bg-[#0d0d0d] border-[#2d2d2d]">
                        <SelectValue placeholder="选择执行方式" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1a18] border-[#2d2d2d] text-white">
                        <SelectItem value="BUILTIN_UPDATE">内置字典更新 (Update set where id = xx)</SelectItem>
                        <SelectItem value="CUSTOM_API">自定义 API (例如 GraphQL Gateway)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedActionType.apiBinding?.mode === 'CUSTOM_API' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs text-[#6b6b6b]">API 地址 (Endpoint)</Label>
                        <Input
                          placeholder="https://api.example.com/graphql"
                          value={selectedActionType.apiBinding?.apiEndpoint || ""}
                          onChange={(e) => updateActionType(selectedActionType.id, {
                            apiBinding: { ...selectedActionType.apiBinding, mode: 'CUSTOM_API', apiEndpoint: e.target.value }
                          })}
                          className="bg-[#0d0d0d] border-[#2d2d2d] font-mono text-xs"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-[#6b6b6b]">自动生成的请求体 (Payload Preview)</Label>
                          <div className="flex items-center gap-1 text-[10px] text-[#3B82F6]">
                            <Code className="w-3 h-3" />
                            <span>基于参数自动映射</span>
                          </div>
                        </div>
                        <div className="p-3 bg-[#0a0a0a] border border-[#2d2d2d] rounded-md overflow-x-auto">
                          <pre className="text-[11px] font-mono text-[#a0a0a0] whitespace-pre-wrap leading-relaxed">
                            {generatePayloadPreview(selectedActionType.inputParameters || [])}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="form" className="m-0 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-white">参数</h3>
                <Button variant="outline" size="sm" onClick={addParameter} className="h-7 text-xs border-[#2d2d2d]">
                  <Plus className="w-3 h-3 mr-1" /> 新增参数
                </Button>
              </div>

              <div className="space-y-2">
                {(!selectedActionType.inputParameters || selectedActionType.inputParameters.length === 0) ? (
                  <div className="text-center py-8 text-xs text-[#6b6b6b] bg-[#0d0d0d] rounded-md border border-[#2d2d2d] border-dashed">
                    暂无参数。点击“新增参数”开始配置。
                  </div>
                ) : (
                  selectedActionType.inputParameters.map((param) => (
                    <div key={param.id} className="flex items-center justify-between p-3 bg-[#0d0d0d] border border-[#2d2d2d] rounded-md group hover:border-[#4d4d4d] transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{param.displayName}</span>
                          {param.required && <span className="text-[10px] text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">必填</span>}
                        </div>
                        <div className="text-xs text-[#6b6b6b] font-mono mt-1">{param.apiName} • {param.baseType}</div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-[#a0a0a0] hover:text-white" onClick={() => setEditingParam(param)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-400/10" onClick={() => removeParameter(param.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              <div className="pt-4 border-t border-[#2d2d2d] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">自定义提交按钮</Label>
                    <p className="text-xs text-[#6b6b6b]">修改提交按钮上的文本</p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">自定义成功提示</Label>
                    <p className="text-xs text-[#6b6b6b]">提交后展示自定义提示信息</p>
                  </div>
                  <Switch />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="m-0">
              <div className="bg-[#0d0d0d] border border-[#2d2d2d] rounded-lg p-6">
                <h3 className="text-lg font-medium text-white mb-6">{selectedActionType.displayName}</h3>
                <div className="space-y-4">
                  {(!selectedActionType.inputParameters || selectedActionType.inputParameters.length === 0) ? (
                    <div className="text-sm text-[#6b6b6b] text-center py-4">暂无可展示的参数</div>
                  ) : (
                    selectedActionType.inputParameters.map((param) => (
                      <div key={param.id} className="space-y-1.5">
                        <Label className="text-sm text-[#e0e0e0]">
                          {param.displayName} {param.required && <span className="text-red-500">*</span>}
                        </Label>
                        {param.baseType === "BOOLEAN" ? (
                          <Select disabled>
                            <SelectTrigger className="bg-[#1a1a18] border-[#2d2d2d]">
                              <SelectValue placeholder="请选择..." />
                            </SelectTrigger>
                          </Select>
                        ) : (
                          <Input className="bg-[#1a1a18] border-[#2d2d2d]" disabled placeholder={`请输入${param.displayName}...`} />
                        )}
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-8 flex justify-end gap-2">
                  <Button variant="outline" disabled className="border-[#2d2d2d]">取消</Button>
                  <Button disabled className="bg-[#10B981] text-white">提交</Button>
                </div>
              </div>
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>

      {/* Constraints Editor Dialog */}
      <Dialog open={!!editingParam} onOpenChange={(v) => !v && setEditingParam(null)}>
        <DialogContent className="bg-[#1a1a18] border-[#2d2d2d] text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑参数约束</DialogTitle>
          </DialogHeader>
          {editingParam && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-[#a0a0a0]">显示名称</Label>
                  <Input 
                    value={editingParam.displayName} 
                    onChange={(e) => setEditingParam({...editingParam, displayName: e.target.value})} 
                    className="bg-[#0d0d0d] border-[#2d2d2d]" 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-[#a0a0a0]">API 名称</Label>
                  <Input 
                    value={editingParam.apiName} 
                    onChange={(e) => setEditingParam({...editingParam, apiName: e.target.value})} 
                    className="bg-[#0d0d0d] border-[#2d2d2d] font-mono text-xs" 
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-[#a0a0a0]">基础类型</Label>
                  <Select 
                    value={editingParam.baseType} 
                    onValueChange={(v) => setEditingParam({...editingParam, baseType: v as PropertyBaseType})}
                  >
                    <SelectTrigger className="bg-[#0d0d0d] border-[#2d2d2d]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a18] border-[#2d2d2d] text-white">
                      <SelectItem value="STRING">字符串</SelectItem>
                      <SelectItem value="INTEGER">整数</SelectItem>
                      <SelectItem value="DOUBLE">小数</SelectItem>
                      <SelectItem value="BOOLEAN">布尔</SelectItem>
                      <SelectItem value="TIMESTAMP">时间戳</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between mt-6">
                  <Label className="text-sm">必填</Label>
                  <Switch 
                    checked={editingParam.required} 
                    onCheckedChange={(c) => setEditingParam({...editingParam, required: c})} 
                  />
                </div>
              </div>

              {/* Constraints Section (Mocking Image 3) */}
              <div className="pt-4 mt-4 border-t border-[#2d2d2d] space-y-4">
                <h4 className="text-sm font-medium">约束</h4>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">允许多选</Label>
                    <p className="text-xs text-[#6b6b6b]">用户可以选择多个值</p>
                  </div>
                  <Switch />
                </div>
                
                <div className="grid grid-cols-4 gap-2">
                  <div className="col-span-1 border border-[#2d2d2d] rounded-md p-2 text-center text-xs bg-[#111111] text-[#a0a0a0] cursor-pointer hover:bg-[#1a1a1a]">用户输入</div>
                  <div className="col-span-1 border border-[#3B82F6] rounded-md p-2 text-center text-xs bg-[#3B82F6]/10 text-[#3B82F6] cursor-pointer font-medium flex items-center justify-center gap-1">
                    多项选择
                  </div>
                  <div className="col-span-1 border border-[#2d2d2d] rounded-md p-2 text-center text-xs bg-[#111111] text-[#a0a0a0] cursor-pointer hover:bg-[#1a1a1a]">用户</div>
                  <div className="col-span-1 border border-[#2d2d2d] rounded-md p-2 text-center text-xs bg-[#111111] text-[#a0a0a0] cursor-pointer hover:bg-[#1a1a1a]">用户组</div>
                </div>

                <div className="p-3 bg-[#0d0d0d] border border-[#2d2d2d] rounded-md space-y-3">
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="border border-[#3B82F6] bg-[#3B82F6]/10 text-[#3B82F6] rounded-md p-2 text-center text-xs font-medium cursor-pointer">手动定义选项</div>
                    <div className="border border-[#2d2d2d] bg-[#111111] text-[#a0a0a0] rounded-md p-2 text-center text-xs cursor-pointer">从对象集获取选项</div>
                  </div>
                  
                  {/* Mock options */}
                  <div className="space-y-2">
                    {['P0', 'P1', 'P2'].map((opt) => (
                      <div key={opt} className="flex gap-2">
                        <Input value={opt} readOnly className="bg-[#1a1a18] border-[#2d2d2d] h-8" />
                        <Input placeholder="显示名称（可选）" className="bg-[#1a1a18] border-[#2d2d2d] h-8" />
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-[#3B82F6] p-0 hover:bg-transparent">
                      <Plus className="w-3 h-3 mr-1" /> 添加选项
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div>
                    <Label className="text-sm">允许“其他”值</Label>
                    <p className="text-xs text-[#6b6b6b]">用户可以输入自定义值</p>
                  </div>
                  <Switch />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingParam(null)} className="border-[#2d2d2d] text-white">取消</Button>
            <Button onClick={() => updateParameter(editingParam!)} className="bg-[#10B981] text-white">保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
