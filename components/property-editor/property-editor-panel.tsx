"use client";

import React from "react";
import {
  X,
  Settings,
  Eye,
  Database,
  Search,
  Trash2,
  Plus,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useOntologyStore } from "@/stores";
import { useSelectionStore } from "@/stores";
import { useUIStore } from "@/stores";
import { ObjectType, Property, PropertyBaseType, PropertyVisibility } from "@/lib/types/ontology";
import { cn, getBaseTypeDisplayName } from "@/lib/utils";
import { PropertyTypeIcon } from "@/components/object-type-manager/property-type-icon";

export function PropertyEditorPanel() {
  const {
    objectTypes,
    linkTypes,
    ormMapping,
    updateObjectType,
    updateLinkType,
    addProperty,
    deleteProperty,
    updateOrmMeta,
    updateOrmTable,
    updateOrmColumn,
  } = useOntologyStore();
  const { selectedObjectTypeId, selectedLinkTypeId, selectObjectType, selectLinkType } = useSelectionStore();
  const { rightPanelOpen, closeRightPanel } = useUIStore();
  const [activeTab, setActiveTab] = React.useState("general");

  const selectedObjectType = objectTypes.find((ot) => ot.id === selectedObjectTypeId);
  const selectedLinkType = linkTypes.find((lt) => lt.id === selectedLinkTypeId);

  if (!rightPanelOpen || (!selectedObjectType && !selectedLinkType)) {
    return null;
  }

  const handleClose = () => {
    closeRightPanel();
    selectObjectType(null);
    selectLinkType(null);
  };

  if (selectedObjectType) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-[#2d2d2d]">
          <div>
            <h2 className="text-sm font-semibold text-white">{selectedObjectType.displayName}</h2>
            <span className="text-xs text-[#6b6b6b] font-mono">{selectedObjectType.apiName}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-[#6b6b6b] hover:text-white" onClick={handleClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="w-full justify-start rounded-none border-b border-[#2d2d2d] bg-transparent p-0 h-auto">
            <TabsTrigger value="general" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#5b8def] data-[state=active]:bg-transparent text-[#6b6b6b] data-[state=active]:text-white px-4 py-2">
              <Settings className="w-3.5 h-3.5 mr-1.5" />基础配置
            </TabsTrigger>
            <TabsTrigger value="properties" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#5b8def] data-[state=active]:bg-transparent text-[#6b6b6b] data-[state=active]:text-white px-4 py-2">
              属性<Badge className="ml-1.5 bg-[#2d2d2d] text-[#6b6b6b]">{selectedObjectType.properties.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="mapping" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#5b8def] data-[state=active]:bg-transparent text-[#6b6b6b] data-[state=active]:text-white px-4 py-2">
              <Database className="w-3.5 h-3.5 mr-1.5" />
              映射
            </TabsTrigger>
            <TabsTrigger value="visibility" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#5b8def] data-[state=active]:bg-transparent text-[#6b6b6b] data-[state=active]:text-white px-4 py-2">
              <Eye className="w-3.5 h-3.5 mr-1.5" />可见性
            </TabsTrigger>
          </TabsList>
          <ScrollArea className="flex-1">
            <TabsContent value="general" className="p-4 m-0 space-y-4">
              <GeneralTab objectType={selectedObjectType} onUpdate={(updates) => updateObjectType(selectedObjectType.id, updates)} />
            </TabsContent>
            <TabsContent value="properties" className="p-4 m-0">
              <PropertiesTab objectType={selectedObjectType} onAddProperty={(prop) => addProperty(selectedObjectType.id, prop)} onDeleteProperty={(propId) => deleteProperty(selectedObjectType.id, propId)} />
            </TabsContent>
            <TabsContent value="mapping" className="p-4 m-0">
              <MappingTab
                objectType={selectedObjectType}
                ormMapping={ormMapping}
                onUpdateOrmMeta={updateOrmMeta}
                onUpdateOrmTable={(updates) => updateOrmTable(selectedObjectType.id, updates)}
                onUpdateOrmColumn={(propertyId, updates) => updateOrmColumn(selectedObjectType.id, propertyId, updates)}
              />
            </TabsContent>
            <TabsContent value="visibility" className="p-4 m-0">
              <VisibilityTab objectType={selectedObjectType} onUpdate={(updates) => updateObjectType(selectedObjectType.id, updates)} />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>
    );
  }

  if (selectedLinkType) {
    const sourceType = objectTypes.find((ot) => ot.id === selectedLinkType.sourceTypeId);
    const targetType = objectTypes.find((ot) => ot.id === selectedLinkType.targetTypeId);
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-[#2d2d2d]">
          <div>
            <h2 className="text-sm font-semibold text-white">{selectedLinkType.displayName}</h2>
            <span className="text-xs text-[#6b6b6b] font-mono">{selectedLinkType.apiName}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-[#6b6b6b] hover:text-white" onClick={handleClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="p-4 border-b border-[#2d2d2d]">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[#a0a0a0]">{sourceType?.displayName || "未知"}</span>
            <ChevronRight className="w-4 h-4 text-[#5b8def]" />
            <span className="text-[#a0a0a0]">{targetType?.displayName || "未知"}</span>
          </div>
          <Badge className="mt-2 bg-[#5b8def]/20 text-[#5b8def] border-[#5b8def]/30">{selectedLinkType.cardinality.replace(/_/g, " ")}</Badge>
        </div>
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Settings className="w-4 h-4" /> 基本配置
              </h3>
              <div className="space-y-2">
                <Label className="text-xs text-[#6b6b6b]">关系类型 ID (需以小写字母开头)</Label>
                <Input value={selectedLinkType.id} disabled className="bg-[#0d0d0d] border-[#2d2d2d] font-mono text-xs opacity-70" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-[#6b6b6b]">全局 API 名称</Label>
                <Input 
                  value={selectedLinkType.apiName} 
                  onChange={(e) => updateLinkType(selectedLinkType.id, { apiName: e.target.value })} 
                  className="bg-[#0d0d0d] border-[#2d2d2d] font-mono text-xs" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-[#6b6b6b]">基数 (Cardinality)</Label>
                <Select value={selectedLinkType.cardinality} onValueChange={(value) => updateLinkType(selectedLinkType.id, { cardinality: value as any })}>
                  <SelectTrigger className="bg-[#0d0d0d] border-[#2d2d2d]"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#1a1a18] border-[#2d2d2d]">
                    <SelectItem value="ONE_TO_ONE">1:1 (一对一)</SelectItem>
                    <SelectItem value="ONE_TO_MANY">1:N (一对多)</SelectItem>
                    <SelectItem value="MANY_TO_ONE">N:1 (多对一)</SelectItem>
                    <SelectItem value="MANY_TO_MANY">M:N (多对多)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator className="bg-[#2d2d2d]" />

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-[#5b8def] flex items-center gap-2">
                目标侧配置 (从 {sourceType?.displayName || "Source"} 到 {targetType?.displayName || "Target"})
              </h3>
              <div className="space-y-2">
                <Label className="text-xs text-[#6b6b6b]">目标侧显示名称</Label>
                <Input 
                  placeholder="如: Assigned Aircraft"
                  value={selectedLinkType.targetDisplayName || ""} 
                  onChange={(e) => updateLinkType(selectedLinkType.id, { targetDisplayName: e.target.value })} 
                  className="bg-[#0d0d0d] border-[#2d2d2d]" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-[#6b6b6b]">目标侧复数显示名称 (用于 N 侧)</Label>
                <Input 
                  placeholder="如: Scheduled Flights"
                  value={selectedLinkType.targetPluralDisplayName || ""} 
                  onChange={(e) => updateLinkType(selectedLinkType.id, { targetPluralDisplayName: e.target.value })} 
                  className="bg-[#0d0d0d] border-[#2d2d2d]" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-[#6b6b6b]">目标侧 API 名称</Label>
                <Input 
                  placeholder="如: assignedAircraft"
                  value={selectedLinkType.targetApiName || ""} 
                  onChange={(e) => updateLinkType(selectedLinkType.id, { targetApiName: e.target.value })} 
                  className="bg-[#0d0d0d] border-[#2d2d2d] font-mono text-xs" 
                />
              </div>
            </div>

            <Separator className="bg-[#2d2d2d]" />

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-orange-400 flex items-center gap-2">
                起始侧配置 (从 {targetType?.displayName || "Target"} 回 {sourceType?.displayName || "Source"})
              </h3>
              <div className="space-y-2">
                <Label className="text-xs text-[#6b6b6b]">起始侧显示名称</Label>
                <Input 
                  value={selectedLinkType.sourceDisplayName || ""} 
                  onChange={(e) => updateLinkType(selectedLinkType.id, { sourceDisplayName: e.target.value })} 
                  className="bg-[#0d0d0d] border-[#2d2d2d]" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-[#6b6b6b]">起始侧复数显示名称 (用于 N 侧)</Label>
                <Input 
                  value={selectedLinkType.sourcePluralDisplayName || ""} 
                  onChange={(e) => updateLinkType(selectedLinkType.id, { sourcePluralDisplayName: e.target.value })} 
                  className="bg-[#0d0d0d] border-[#2d2d2d]" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-[#6b6b6b]">起始侧 API 名称 (逆向引用)</Label>
                <Input 
                  placeholder="如: flights"
                  value={selectedLinkType.sourceApiName || selectedLinkType.inverseLinkName || ""} 
                  onChange={(e) => updateLinkType(selectedLinkType.id, { sourceApiName: e.target.value, inverseLinkName: e.target.value })} 
                  className="bg-[#0d0d0d] border-[#2d2d2d] font-mono text-xs" 
                />
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }
  return null;
}

function GeneralTab({ objectType, onUpdate }: { objectType: ObjectType; onUpdate: (updates: Partial<ObjectType>) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2"><Label className="text-xs text-[#6b6b6b]">显示名称</Label><Input value={objectType.displayName} onChange={(e) => onUpdate({ displayName: e.target.value })} className="bg-[#0d0d0d] border-[#2d2d2d]" /></div>
      <div className="space-y-2"><Label className="text-xs text-[#6b6b6b]">API 名称</Label><Input value={objectType.apiName} onChange={(e) => onUpdate({ apiName: e.target.value })} className="bg-[#0d0d0d] border-[#2d2d2d] font-mono" /></div>
      <div className="space-y-2"><Label className="text-xs text-[#6b6b6b]">描述</Label><Textarea value={objectType.description || ""} onChange={(e) => onUpdate({ description: e.target.value })} className="bg-[#0d0d0d] border-[#2d2d2d] min-h-[80px]" /></div>
      <div className="space-y-2">
        <Label className="text-xs text-[#6b6b6b]">主键</Label>
        <Select value={objectType.primaryKey} onValueChange={(value) => onUpdate({ primaryKey: value })}>
          <SelectTrigger className="bg-[#0d0d0d] border-[#2d2d2d]"><SelectValue placeholder="选择主键属性" /></SelectTrigger>
          <SelectContent className="bg-[#1a1a18] border-[#2d2d2d]">
            {objectType.properties.map((prop) => (<SelectItem key={prop.id} value={prop.id}>{prop.displayName}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function PropertiesTab({ objectType, onAddProperty, onDeleteProperty }: { objectType: ObjectType; onAddProperty: (prop: Omit<Property, "id">) => void; onDeleteProperty: (propId: string) => void }) {
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [newProp, setNewProp] = React.useState({ displayName: "", apiName: "", baseType: "STRING" as PropertyBaseType, visibility: "NORMAL" as PropertyVisibility, required: false });

  const handleAdd = () => {
    if (newProp.displayName && newProp.apiName) {
      onAddProperty({ ...newProp, apiName: newProp.apiName.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "") });
      setNewProp({ displayName: "", apiName: "", baseType: "STRING", visibility: "NORMAL", required: false });
      setShowAddForm(false);
    }
  };

  return (
    <div className="space-y-3">
      {objectType.properties.map((prop) => (
        <div key={prop.id} className="p-3 rounded-lg bg-[#0d0d0d] border border-[#2d2d2d] hover:border-[#3d3d3d] transition-colors">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2"><PropertyTypeIcon type={prop.baseType} /><span className="text-sm text-white">{prop.displayName}</span><span className="text-xs text-[#6b6b6b] font-mono ml-2">{prop.apiName}</span></div>
            <div className="flex items-center gap-1">
              <Badge variant="outline" className={cn("text-[10px]", prop.visibility === "PROMINENT" ? "border-[#5b8def]/30 text-[#5b8def]" : prop.visibility === "HIDDEN" ? "border-[#6b6b6b]/30 text-[#6b6b6b]" : "border-[#2d2d2d] text-[#6b6b6b]")}>{getBaseTypeDisplayName(prop.baseType)}</Badge>
              {objectType.primaryKey === prop.id && <Badge className="bg-[#5b8def]/20 text-[#5b8def] border-[#5b8def]/30 text-[10px]">PK</Badge>}
              <Button variant="ghost" size="icon" className="h-6 w-6 text-[#6b6b6b] hover:text-red-400" onClick={() => onDeleteProperty(prop.id)}><Trash2 className="w-3 h-3" /></Button>
            </div>
          </div>
        </div>
      ))}
      {showAddForm ? (
        <div className="p-3 rounded-lg bg-[#0d0d0d] border border-[#5b8def]/30 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label className="text-[10px] text-[#6b6b6b]">显示名称</Label><Input value={newProp.displayName} onChange={(e) => setNewProp({ ...newProp, displayName: e.target.value })} className="h-8 bg-[#1a1a18] border-[#2d2d2d] text-sm" /></div>
            <div className="space-y-1"><Label className="text-[10px] text-[#6b6b6b]">API 名称</Label><Input value={newProp.apiName} onChange={(e) => setNewProp({ ...newProp, apiName: e.target.value })} className="h-8 bg-[#1a1a18] border-[#2d2d2d] text-sm font-mono" /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-[#6b6b6b]">类型</Label>
              <Select value={newProp.baseType} onValueChange={(value) => setNewProp({ ...newProp, baseType: value as PropertyBaseType })}>
                <SelectTrigger className="h-8 bg-[#1a1a18] border-[#2d2d2d]"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#1a1a18] border-[#2d2d2d]">
                  <SelectItem value="STRING">STRING (文本)</SelectItem>
                  <SelectItem value="INTEGER">INTEGER (整数)</SelectItem>
                  <SelectItem value="DOUBLE">DOUBLE (小数)</SelectItem>
                  <SelectItem value="BOOLEAN">BOOLEAN (布尔)</SelectItem>
                  <SelectItem value="TIMESTAMP">TIMESTAMP (时间)</SelectItem>
                  <SelectItem value="STRUCT">STRUCT (结构体)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-[#6b6b6b]">可见性</Label>
              <Select value={newProp.visibility} onValueChange={(value) => setNewProp({ ...newProp, visibility: value as PropertyVisibility })}>
                <SelectTrigger className="h-8 bg-[#1a1a18] border-[#2d2d2d]"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#1a1a18] border-[#2d2d2d]">
                  <SelectItem value="NORMAL">普通</SelectItem>
                  <SelectItem value="PROMINENT">重要</SelectItem>
                  <SelectItem value="HIDDEN">隐藏</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2"><Switch checked={newProp.required} onCheckedChange={(checked) => setNewProp({ ...newProp, required: checked })} /><span className="text-xs text-[#a0a0a0]">必填</span></div>
          <div className="flex justify-end gap-2">
<Button variant="ghost" size="sm" className="text-xs text-[#6b6b6b]" onClick={() => setShowAddForm(false)}>取消</Button>
            <Button size="sm" className="text-xs bg-[#5b8def] hover:bg-[#4a7ce0]" onClick={handleAdd}>添加</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="w-full border-dashed border-[#2d2d2d] text-[#6b6b6b] hover:bg-[#2d2d2d] hover:text-white" onClick={() => setShowAddForm(true)}><Plus className="w-3.5 h-3.5 mr-1.5" />添加属性</Button>
      )}
    </div>
  );
}

function MappingTab({
  objectType,
  ormMapping,
  onUpdateOrmMeta,
  onUpdateOrmTable,
  onUpdateOrmColumn,
}: {
  objectType: ObjectType;
  ormMapping: any;
  onUpdateOrmMeta: (updates: { databaseName?: string; schemaName?: string }) => void;
  onUpdateOrmTable: (updates: any) => void;
  onUpdateOrmColumn: (propertyId: string, updates: any) => void;
}) {
  const table = ormMapping?.tables?.[objectType.id];
  const dialect = ormMapping?.dialect || "postgres";
  const [searchOpen, setSearchOpen] = React.useState(true);
  const [dbOpen, setDbOpen] = React.useState(true);
  const [tableOpen, setTableOpen] = React.useState(true);
  const [fieldsOpen, setFieldsOpen] = React.useState(true);
  const [searchText, setSearchText] = React.useState("");

  if (!table) {
    return <div className="text-xs text-[#6b6b6b]">未找到该对象的映射信息</div>;
  }

  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredProps = normalizedSearch
    ? objectType.properties.filter((prop) => {
        const col = table.columns?.[prop.id];
        const hay = [
          prop.displayName,
          prop.apiName,
          String(col?.columnName || ""),
          String(col?.sqlType || ""),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(normalizedSearch);
      })
    : objectType.properties;

  return (
    <div className="space-y-6">
      <Collapsible open={searchOpen} onOpenChange={setSearchOpen}>
        <CollapsibleTrigger asChild>
          <button type="button" className="w-full flex items-center justify-between text-sm font-medium text-white">
            <span className="flex items-center gap-2">
              <Search className="w-4 h-4" /> 搜索
            </span>
            <ChevronDown className={cn("w-4 h-4 text-[#6b6b6b] transition-transform", searchOpen ? "rotate-180" : "")} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="bg-[#0d0d0d] border-[#2d2d2d]"
            placeholder="按属性名 / apiName / column / sqlType 搜索"
          />
        </CollapsibleContent>
      </Collapsible>

      <Separator className="bg-[#2d2d2d]" />

      <Collapsible open={dbOpen} onOpenChange={setDbOpen}>
        <CollapsibleTrigger asChild>
          <button type="button" className="w-full flex items-center justify-between text-sm font-medium text-white">
            <span className="flex items-center gap-2">
              <Database className="w-4 h-4" /> 数据库配置
            </span>
            <ChevronDown className={cn("w-4 h-4 text-[#6b6b6b] transition-transform", dbOpen ? "rotate-180" : "")} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs text-[#6b6b6b]">Dialect</Label>
              <Input value={dialect} disabled className="bg-[#0d0d0d] border-[#2d2d2d] font-mono text-xs opacity-70" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-[#6b6b6b]">Schema</Label>
              <Input
                value={ormMapping?.schemaName || ""}
                onChange={(e) => onUpdateOrmMeta({ schemaName: e.target.value })}
                className="bg-[#0d0d0d] border-[#2d2d2d] font-mono text-xs"
                placeholder="public"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-[#6b6b6b]">Database</Label>
            <Input
              value={ormMapping?.databaseName || ""}
              onChange={(e) => onUpdateOrmMeta({ databaseName: e.target.value })}
              className="bg-[#0d0d0d] border-[#2d2d2d] font-mono text-xs"
              placeholder="erp_procurement"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Separator className="bg-[#2d2d2d]" />

      <Collapsible open={tableOpen} onOpenChange={setTableOpen}>
        <CollapsibleTrigger asChild>
          <button type="button" className="w-full flex items-center justify-between text-sm font-medium text-white">
            <span>表映射</span>
            <ChevronDown className={cn("w-4 h-4 text-[#6b6b6b] transition-transform", tableOpen ? "rotate-180" : "")} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-3">
          <div className="space-y-2">
            <Label className="text-xs text-[#6b6b6b]">Table</Label>
            <Input
              value={table.tableName || ""}
              onChange={(e) => onUpdateOrmTable({ tableName: e.target.value })}
              className="bg-[#0d0d0d] border-[#2d2d2d] font-mono text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs text-[#6b6b6b]">Primary Key Strategy</Label>
              <Input value={table.primaryKeyStrategy || ""} disabled className="bg-[#0d0d0d] border-[#2d2d2d] font-mono text-xs opacity-70" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-[#6b6b6b]">Primary Key Property</Label>
              <Input value={table.primaryKeyPropertyId || ""} disabled className="bg-[#0d0d0d] border-[#2d2d2d] font-mono text-xs opacity-70" />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Separator className="bg-[#2d2d2d]" />

      <Collapsible open={fieldsOpen} onOpenChange={setFieldsOpen}>
        <CollapsibleTrigger asChild>
          <button type="button" className="w-full flex items-center justify-between text-sm font-medium text-white">
            <span className="flex items-center gap-2">
              字段映射
              <Badge className="bg-[#2d2d2d] text-[#6b6b6b]">{filteredProps.length}</Badge>
            </span>
            <ChevronDown className={cn("w-4 h-4 text-[#6b6b6b] transition-transform", fieldsOpen ? "rotate-180" : "")} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <ScrollArea className="h-[420px] rounded-md border border-[#2d2d2d]">
            <div className="p-2 space-y-2">
              {filteredProps.map((prop) => {
                const col = table.columns?.[prop.id];
                return (
                  <div key={prop.id} className="p-3 rounded-lg bg-[#0d0d0d] border border-[#2d2d2d]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm text-white truncate">{prop.displayName}</div>
                        <div className="text-[11px] text-[#6b6b6b] font-mono truncate">
                          {prop.apiName} · {getBaseTypeDisplayName(prop.baseType)}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div className="space-y-2">
                        <Label className="text-xs text-[#6b6b6b]">Column</Label>
                        <Input
                          value={col?.columnName || ""}
                          onChange={(e) => onUpdateOrmColumn(prop.id, { columnName: e.target.value })}
                          className="bg-[#0d0d0d] border-[#2d2d2d] font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-[#6b6b6b]">SQL Type (可选)</Label>
                        <Input
                          value={col?.sqlType || ""}
                          onChange={(e) => onUpdateOrmColumn(prop.id, { sqlType: e.target.value })}
                          className="bg-[#0d0d0d] border-[#2d2d2d] font-mono text-xs"
                          placeholder="text / timestamptz / double precision ..."
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function VisibilityTab({ objectType, onUpdate }: { objectType: ObjectType; onUpdate: (updates: Partial<ObjectType>) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs text-[#6b6b6b]">可见性级别</Label>
        <Select value={objectType.visibility} onValueChange={(value) => onUpdate({ visibility: value as any })}>
          <SelectTrigger className="bg-[#0d0d0d] border-[#2d2d2d]"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-[#1a1a18] border-[#2d2d2d]">
            <SelectItem value="PRIVATE"><span className="text-red-400">私有</span> - 仅创建者可见</SelectItem>
            <SelectItem value="PROJECT"><span className="text-yellow-400">项目级</span> - 项目成员可见</SelectItem>
            <SelectItem value="GLOBAL"><span className="text-green-400">全局</span> - 所有用户可见</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Separator className="bg-[#2d2d2d]" />
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-white">属性可见性</h4>
        {objectType.properties.map((prop) => (
          <div key={prop.id} className="flex items-center justify-between p-2 rounded-lg bg-[#0d0d0d]">
            <div className="flex items-center gap-2"><PropertyTypeIcon type={prop.baseType} /><span className="text-sm text-white">{prop.displayName}</span></div>
            <Select value={prop.visibility} onValueChange={(value) => onUpdate({ properties: objectType.properties.map((p) => p.id === prop.id ? { ...p, visibility: value as PropertyVisibility } : p) })}>
              <SelectTrigger className="w-28 h-7 bg-[#1a1a18] border-[#2d2d2d]"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#1a1a18] border-[#2d2d2d]">
                <SelectItem value="NORMAL">普通</SelectItem>
                <SelectItem value="PROMINENT">重要</SelectItem>
                <SelectItem value="HIDDEN">隐藏</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  );
}
