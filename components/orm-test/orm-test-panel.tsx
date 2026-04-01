"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, User, Send, Loader2 } from "lucide-react";
import { useOntologyStore } from "@/stores";

interface Message {
  role: "user" | "assistant";
  content: string;
  isJson?: boolean;
}

export function OrmTestPanel() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const { objectTypes, linkTypes, actionTypes } = useOntologyStore();

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/orm-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: userMessage.content,
          context: {
            objectTypes,
            linkTypes,
            actionTypes,
          }
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch");
      }

      const data = await response.json();
      
      setMessages((prev) => [
        ...prev,
        { 
          role: "assistant", 
          content: JSON.stringify(data, null, 2),
          isJson: true
        },
      ]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "抱歉，生成失败，请重试。" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d] text-[#e0e0e0]">
      <div className="flex-none p-4 border-b border-[#2d2d2d] bg-[#161614]">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Bot className="w-5 h-5 text-[#10B981]" />
          ORM 测试助手
        </h2>
        <p className="text-xs text-[#808080] mt-1">
          通过自然语言与数据库沟通，返回基于当前 Ontology 的稳定 JSON 结构 (SQL & API)
        </p>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 pb-4">
          {messages.length === 0 && (
            <div className="text-center text-[#6b6b6b] text-sm mt-10">
              您可以输入类似：“查询所有状态为待审批的采购申请”，或“创建一个采购订单”。
            </div>
          )}
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${
                msg.role === "user" ? "flex-row-reverse" : "flex-row"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === "user"
                    ? "bg-[#2563EB] text-white"
                    : "bg-[#10B981] text-white"
                }`}
              >
                {msg.role === "user" ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
              </div>
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  msg.role === "user"
                    ? "bg-[#2563EB]/20 border border-[#2563EB]/30 text-white"
                    : "bg-[#2d2d2d] border border-[#3d3d3d] text-[#d0d0d0]"
                }`}
              >
                {msg.isJson ? (
                  <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                    {msg.content}
                  </pre>
                ) : (
                  <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-[#10B981] text-white flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div className="p-3 rounded-lg bg-[#2d2d2d] border border-[#3d3d3d] flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#10B981]" />
                <span className="text-sm text-[#808080]">正在思考...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="flex-none p-4 border-t border-[#2d2d2d] bg-[#161614]">
        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="输入自然语言描述..."
            className="flex-1 bg-[#0d0d0d] border-[#3d3d3d] text-white placeholder:text-[#6b6b6b]"
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="bg-[#10B981] hover:bg-[#059669] text-white"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
