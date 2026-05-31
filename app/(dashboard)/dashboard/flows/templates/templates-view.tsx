"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  MessageSquare,
  HelpCircle,
  UserPlus,
  GitBranch,
  Loader2,
  BookmarkPlus,
  ArrowLeft,
  ShoppingCart,
  Calendar,
  Gift,
  Star,
  TrendingUp,
  Bell,
  RefreshCw,
  Headphones,
  Users,
  Zap,
  Heart,
  Award,
  Package,
  Phone,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

// --- Template types ---

interface TemplateNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

interface TemplateEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  nodes: TemplateNode[];
  edges: TemplateEdge[];
}

// --- Built-in templates ---

const templates: FlowTemplate[] = [
  // ─── ONBOARDING ───────────────────────────────────────────────
  {
    id: "welcome-flow",
    name: "Welcome Flow",
    description:
      "Greet new subscribers with a warm welcome, wait a minute, then send a follow-up to keep them engaged.",
    category: "Onboarding",
    icon: MessageSquare,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: { label: "Welcome Trigger", triggerType: "welcome", config: {} },
      },
      {
        id: "msg-1",
        type: "sendMessage",
        position: { x: 250, y: 150 },
        data: {
          label: "Greeting",
          text: "Hey there! Welcome! 👋 We're so glad to have you here. How can we help you today?",
        },
      },
      {
        id: "delay-1",
        type: "delay",
        position: { x: 250, y: 300 },
        data: { label: "Wait 1 minute", duration: 60, unit: "seconds" },
      },
      {
        id: "msg-2",
        type: "sendMessage",
        position: { x: 250, y: 450 },
        data: {
          label: "Follow-up",
          text: "By the way, feel free to ask me anything. I'm here to help! 😊",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "msg-1" },
      { id: "e2", source: "msg-1", target: "delay-1" },
      { id: "e3", source: "delay-1", target: "msg-2" },
    ],
  },
  {
    id: "onboarding-quiz",
    name: "Onboarding Quiz",
    description:
      "Qualify new leads by asking 3 targeted questions, tag them by profile and send a personalised recommendation.",
    category: "Onboarding",
    icon: Search,
    iconColor: "text-indigo-600",
    iconBg: "bg-indigo-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: { label: "New Subscriber", triggerType: "welcome", config: {} },
      },
      {
        id: "msg-q1",
        type: "sendMessage",
        position: { x: 250, y: 150 },
        data: {
          label: "Question 1",
          text: "Welcome! To get started, what best describes you?\n\nA) Business Owner\nB) Freelancer\nC) Student",
        },
      },
      {
        id: "wait-1",
        type: "smartDelay",
        position: { x: 250, y: 280 },
        data: { label: "Wait for reply", waitForInput: true, timeout: 600 },
      },
      {
        id: "set-role",
        type: "setCustomField",
        position: { x: 250, y: 400 },
        data: { label: "Save role", fieldSlug: "role", value: "{{last_message}}" },
      },
      {
        id: "msg-rec",
        type: "sendMessage",
        position: { x: 250, y: 530 },
        data: {
          label: "Personalised Recommendation",
          text: "Thanks, {{name}}! Based on your profile, here's what we recommend for you 👇",
        },
      },
      {
        id: "tag-qualified",
        type: "addTag",
        position: { x: 250, y: 660 },
        data: { label: "Tag: qualified-lead", tagName: "qualified-lead" },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "msg-q1" },
      { id: "e2", source: "msg-q1", target: "wait-1" },
      { id: "e3", source: "wait-1", target: "set-role" },
      { id: "e4", source: "set-role", target: "msg-rec" },
      { id: "e5", source: "msg-rec", target: "tag-qualified" },
    ],
  },

  // ─── SUPPORT ──────────────────────────────────────────────────
  {
    id: "faq-bot",
    name: "FAQ Bot",
    description:
      'Respond to "help" or "faq" keywords by checking the message and routing to different answer branches.',
    category: "Support",
    icon: HelpCircle,
    iconColor: "text-amber-600",
    iconBg: "bg-amber-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: {
          label: "FAQ Trigger",
          triggerType: "keyword",
          config: { keywords: ["help", "faq"] },
        },
      },
      {
        id: "condition-1",
        type: "condition",
        position: { x: 250, y: 150 },
        data: {
          label: "Check keyword",
          conditions: [
            { id: "c1", field: "trigger_keyword", operator: "equals", value: "help" },
          ],
        },
      },
      {
        id: "msg-help",
        type: "sendMessage",
        position: { x: 50, y: 350 },
        data: {
          label: "Help response",
          text: "Here are some things I can help you with:\n- Pricing info\n- Account setup\n- Technical support\n\nJust type your question!",
        },
      },
      {
        id: "msg-faq",
        type: "sendMessage",
        position: { x: 450, y: 350 },
        data: {
          label: "FAQ response",
          text: "Here are our most frequently asked questions:\n\n1. How do I get started?\n2. What plans are available?\n3. How do I contact support?\n\nReply with a number for more details!",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "condition-1" },
      { id: "e2", source: "condition-1", target: "msg-help", sourceHandle: "true" },
      { id: "e3", source: "condition-1", target: "msg-faq", sourceHandle: "false" },
    ],
  },
  {
    id: "live-agent-handoff",
    name: "Live Agent Handoff",
    description:
      "Detect frustration keywords, collect the customer's issue, then seamlessly hand off to a human agent and tag the conversation.",
    category: "Support",
    icon: Headphones,
    iconColor: "text-rose-600",
    iconBg: "bg-rose-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: {
          label: "Frustration Keywords",
          triggerType: "keyword",
          config: { keywords: ["agent", "human", "speak to someone", "not happy"] },
        },
      },
      {
        id: "msg-1",
        type: "sendMessage",
        position: { x: 250, y: 150 },
        data: {
          label: "Acknowledge",
          text: "I'm sorry to hear that! 😔 Let me connect you with one of our agents right away. Can you briefly describe your issue?",
        },
      },
      {
        id: "wait-1",
        type: "smartDelay",
        position: { x: 250, y: 300 },
        data: { label: "Wait for issue", waitForInput: true, timeout: 300 },
      },
      {
        id: "set-issue",
        type: "setCustomField",
        position: { x: 250, y: 420 },
        data: { label: "Save issue", fieldSlug: "support_issue", value: "{{last_message}}" },
      },
      {
        id: "tag-1",
        type: "addTag",
        position: { x: 250, y: 540 },
        data: { label: "Tag: needs-human", tagName: "needs-human" },
      },
      {
        id: "msg-2",
        type: "sendMessage",
        position: { x: 250, y: 660 },
        data: {
          label: "Handoff message",
          text: "Thank you! An agent will be with you in a few minutes. ⏳ Your reference number is #{{contact_id}}.",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "msg-1" },
      { id: "e2", source: "msg-1", target: "wait-1" },
      { id: "e3", source: "wait-1", target: "set-issue" },
      { id: "e4", source: "set-issue", target: "tag-1" },
      { id: "e5", source: "tag-1", target: "msg-2" },
    ],
  },

  // ─── MARKETING ────────────────────────────────────────────────
  {
    id: "lead-capture",
    name: "Lead Capture",
    description:
      "Collect lead information step by step: ask for name, wait for response, save it, then ask for email and tag the contact.",
    category: "Marketing",
    icon: UserPlus,
    iconColor: "text-green-600",
    iconBg: "bg-green-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: {
          label: "Lead Trigger",
          triggerType: "keyword",
          config: { keywords: ["interested", "info", "pricing"] },
        },
      },
      {
        id: "msg-name",
        type: "sendMessage",
        position: { x: 250, y: 120 },
        data: { label: "Ask name", text: "Great, I'd love to help! What's your name?" },
      },
      {
        id: "wait-name",
        type: "smartDelay",
        position: { x: 250, y: 240 },
        data: { label: "Wait for name", waitForInput: true, timeout: 300 },
      },
      {
        id: "set-name",
        type: "setCustomField",
        position: { x: 250, y: 360 },
        data: { label: "Save name", fieldSlug: "name", value: "{{last_message}}" },
      },
      {
        id: "msg-email",
        type: "sendMessage",
        position: { x: 250, y: 480 },
        data: {
          label: "Ask email",
          text: "Thanks, {{name}}! What's your email address so we can send you more details?",
        },
      },
      {
        id: "wait-email",
        type: "smartDelay",
        position: { x: 250, y: 600 },
        data: { label: "Wait for email", waitForInput: true, timeout: 300 },
      },
      {
        id: "set-email",
        type: "setCustomField",
        position: { x: 250, y: 720 },
        data: { label: "Save email", fieldSlug: "email", value: "{{last_message}}" },
      },
      {
        id: "tag-lead",
        type: "addTag",
        position: { x: 250, y: 840 },
        data: { label: 'Add "lead" tag', tagName: "lead" },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "msg-name" },
      { id: "e2", source: "msg-name", target: "wait-name" },
      { id: "e3", source: "wait-name", target: "set-name" },
      { id: "e4", source: "set-name", target: "msg-email" },
      { id: "e5", source: "msg-email", target: "wait-email" },
      { id: "e6", source: "wait-email", target: "set-email" },
      { id: "e7", source: "set-email", target: "tag-lead" },
    ],
  },
  {
    id: "gated-resource-dm",
    name: "Gated Resource DM",
    description:
      "Trigger from a comment keyword, verify subscription status, ask non-subscribers to subscribe in DM, then deliver the promised resource after confirmation.",
    category: "Marketing",
    icon: Gift,
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-100",
    nodes: [
      {
        id: "trigger-comment",
        type: "trigger",
        position: { x: 320, y: 0 },
        data: {
          label: "Comment keyword",
          triggerType: "comment_keyword",
          keywords: [
            { value: "prompt", matchType: "contains" },
            { value: "guide", matchType: "contains" },
          ],
        },
      },
      {
        id: "check-subscriber",
        type: "condition",
        position: { x: 320, y: 150 },
        data: {
          label: "Already subscribed?",
          logic: "and",
          conditions: [
            { field: "is_subscribed", operator: "equals", value: "true" },
          ],
        },
      },
      {
        id: "deliver-existing",
        type: "action",
        position: { x: 80, y: 340 },
        data: {
          label: "Send resource",
          actionType: "privateReply",
          text:
            "Thanks for commenting! You are already subscribed, so here is the resource:\n\n{{resource_link}}\n\nEnjoy!",
        },
      },
      {
        id: "ask-subscribe",
        type: "action",
        position: { x: 560, y: 320 },
        data: {
          label: "Ask to subscribe",
          actionType: "privateReply",
          text:
            "Almost there. To receive the resource, subscribe/follow this account first. After that, tap the confirmation button in this DM and I will send it to you.",
        },
      },
      {
        id: "confirm-button",
        type: "sendMessage",
        position: { x: 560, y: 480 },
        data: {
          label: "Confirm button",
          messages: [
            {
              text: "Once you are subscribed, tap below so I can check and send the resource.",
              buttons: [
                {
                  title: "I subscribed",
                  type: "postback",
                  payload: "CONFIRM_SUBSCRIBED_FOR_RESOURCE",
                },
              ],
            },
          ],
        },
      },
      {
        id: "wait-confirmation",
        type: "action",
        position: { x: 560, y: 640 },
        data: {
          label: "Wait for confirmation",
          actionType: "smartDelay",
          timeout: 24,
          timeoutUnit: "hours",
        },
      },
      {
        id: "recheck-subscriber",
        type: "condition",
        position: { x: 560, y: 800 },
        data: {
          label: "Subscribed now?",
          logic: "and",
          conditions: [
            { field: "is_subscribed", operator: "equals", value: "true" },
          ],
        },
      },
      {
        id: "deliver-new",
        type: "sendMessage",
        position: { x: 340, y: 980 },
        data: {
          label: "Deliver resource",
          messages: [
            {
              text:
                "Perfect, thanks for subscribing! Here is the resource:\n\n{{resource_link}}\n\nReply if you want help using it.",
            },
          ],
        },
      },
      {
        id: "tag-resource-sent",
        type: "action",
        position: { x: 340, y: 1140 },
        data: {
          label: "Tag resource sent",
          actionType: "addTag",
          action: "add",
          tagName: "resource-sent",
        },
      },
      {
        id: "remind-subscribe",
        type: "sendMessage",
        position: { x: 760, y: 980 },
        data: {
          label: "Not subscribed yet",
          messages: [
            {
              text:
                "I cannot verify the subscription yet. Subscribe/follow first, then tap the confirmation button again and I will unlock the resource.",
              buttons: [
                {
                  title: "Check again",
                  type: "postback",
                  payload: "CONFIRM_SUBSCRIBED_FOR_RESOURCE",
                },
              ],
            },
          ],
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-comment", target: "check-subscriber" },
      { id: "e2", source: "check-subscriber", target: "deliver-existing", sourceHandle: "true" },
      { id: "e3", source: "check-subscriber", target: "ask-subscribe", sourceHandle: "false" },
      { id: "e4", source: "ask-subscribe", target: "confirm-button" },
      { id: "e5", source: "confirm-button", target: "wait-confirmation" },
      { id: "e6", source: "wait-confirmation", target: "recheck-subscriber" },
      { id: "e7", source: "recheck-subscriber", target: "deliver-new", sourceHandle: "true" },
      { id: "e8", source: "deliver-new", target: "tag-resource-sent" },
      { id: "e9", source: "recheck-subscriber", target: "remind-subscribe", sourceHandle: "false" },
      { id: "e10", source: "remind-subscribe", target: "wait-confirmation" },
    ],
  },
  {
    id: "appointment-booking",
    name: "Appointment Booking",
    description:
      "Qualify the prospect with 2 quick questions, then send a Calendly link to book a call — fully automated.",
    category: "Marketing",
    icon: Calendar,
    iconColor: "text-violet-600",
    iconBg: "bg-violet-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: {
          label: "Book a Call",
          triggerType: "keyword",
          config: { keywords: ["book", "call", "appointment", "demo"] },
        },
      },
      {
        id: "msg-q1",
        type: "sendMessage",
        position: { x: 250, y: 150 },
        data: {
          label: "Budget question",
          text: "Awesome! Before I share the link, quick question — what's your monthly budget range?\n\nA) Under $500\nB) $500–$2,000\nC) $2,000+",
        },
      },
      {
        id: "wait-q1",
        type: "smartDelay",
        position: { x: 250, y: 280 },
        data: { label: "Wait for budget", waitForInput: true, timeout: 600 },
      },
      {
        id: "set-budget",
        type: "setCustomField",
        position: { x: 250, y: 400 },
        data: { label: "Save budget", fieldSlug: "budget", value: "{{last_message}}" },
      },
      {
        id: "msg-q2",
        type: "sendMessage",
        position: { x: 250, y: 530 },
        data: {
          label: "Timeline question",
          text: "Great! And when are you looking to get started?\n\nA) ASAP\nB) Next month\nC) Just exploring",
        },
      },
      {
        id: "wait-q2",
        type: "smartDelay",
        position: { x: 250, y: 660 },
        data: { label: "Wait for timeline", waitForInput: true, timeout: 600 },
      },
      {
        id: "msg-link",
        type: "sendMessage",
        position: { x: 250, y: 790 },
        data: {
          label: "Send Calendly",
          text: "Perfect! Here's the link to book your free 30-min strategy call 📅\n\nhttps://calendly.com/your-link\n\nSee you soon, {{name}}!",
        },
      },
      {
        id: "tag-hot",
        type: "addTag",
        position: { x: 250, y: 920 },
        data: { label: "Tag: hot-lead", tagName: "hot-lead" },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "msg-q1" },
      { id: "e2", source: "msg-q1", target: "wait-q1" },
      { id: "e3", source: "wait-q1", target: "set-budget" },
      { id: "e4", source: "set-budget", target: "msg-q2" },
      { id: "e5", source: "msg-q2", target: "wait-q2" },
      { id: "e6", source: "wait-q2", target: "msg-link" },
      { id: "e7", source: "msg-link", target: "tag-hot" },
    ],
  },
  {
    id: "viral-giveaway",
    name: "Viral Giveaway",
    description:
      "Run a contest: collect email, confirm entry, ask them to share for bonus entries — skyrocket your audience.",
    category: "Marketing",
    icon: Gift,
    iconColor: "text-pink-600",
    iconBg: "bg-pink-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: {
          label: "Giveaway keyword",
          triggerType: "keyword",
          config: { keywords: ["giveaway", "contest", "win", "enter"] },
        },
      },
      {
        id: "msg-1",
        type: "sendMessage",
        position: { x: 250, y: 150 },
        data: {
          label: "Entry message",
          text: "🎉 You're entering our giveaway! To confirm your entry, what's your email address?",
        },
      },
      {
        id: "wait-email",
        type: "smartDelay",
        position: { x: 250, y: 280 },
        data: { label: "Wait for email", waitForInput: true, timeout: 300 },
      },
      {
        id: "set-email",
        type: "setCustomField",
        position: { x: 250, y: 400 },
        data: { label: "Save email", fieldSlug: "email", value: "{{last_message}}" },
      },
      {
        id: "tag-entrant",
        type: "addTag",
        position: { x: 250, y: 520 },
        data: { label: "Tag: giveaway-entrant", tagName: "giveaway-entrant" },
      },
      {
        id: "msg-share",
        type: "sendMessage",
        position: { x: 250, y: 650 },
        data: {
          label: "Share for bonus",
          text: "✅ You're in! Want 3x more chances to win? Share this post and reply \"SHARED\" below! 🚀",
        },
      },
      {
        id: "wait-share",
        type: "smartDelay",
        position: { x: 250, y: 780 },
        data: { label: "Wait for shared", waitForInput: true, timeout: 1800 },
      },
      {
        id: "tag-bonus",
        type: "addTag",
        position: { x: 250, y: 900 },
        data: { label: "Tag: bonus-entries", tagName: "bonus-entries" },
      },
      {
        id: "msg-confirm",
        type: "sendMessage",
        position: { x: 250, y: 1020 },
        data: {
          label: "Bonus confirmed",
          text: "🔥 Awesome! Your bonus entries have been added. Good luck — winner announced on Friday! 🤞",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "msg-1" },
      { id: "e2", source: "msg-1", target: "wait-email" },
      { id: "e3", source: "wait-email", target: "set-email" },
      { id: "e4", source: "set-email", target: "tag-entrant" },
      { id: "e5", source: "tag-entrant", target: "msg-share" },
      { id: "e6", source: "msg-share", target: "wait-share" },
      { id: "e7", source: "wait-share", target: "tag-bonus" },
      { id: "e8", source: "tag-bonus", target: "msg-confirm" },
    ],
  },

  // ─── E-COMMERCE ───────────────────────────────────────────────
  {
    id: "abandoned-cart",
    name: "Abandoned Cart Recovery",
    description:
      "Re-engage users who viewed a product but didn't buy. Send a reminder after 1h, then a discount code after 24h.",
    category: "E-commerce",
    icon: ShoppingCart,
    iconColor: "text-orange-600",
    iconBg: "bg-orange-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: {
          label: "Cart Abandoned",
          triggerType: "keyword",
          config: { keywords: ["cart", "abandoned"] },
        },
      },
      {
        id: "delay-1h",
        type: "delay",
        position: { x: 250, y: 150 },
        data: { label: "Wait 1 hour", duration: 3600, unit: "seconds" },
      },
      {
        id: "msg-reminder",
        type: "sendMessage",
        position: { x: 250, y: 300 },
        data: {
          label: "Reminder",
          text: "Hey {{name}}, you left something in your cart! 🛒 Your items are reserved for a limited time. Ready to complete your order?",
        },
      },
      {
        id: "condition-1",
        type: "condition",
        position: { x: 250, y: 450 },
        data: {
          label: "Did they buy?",
          conditions: [{ id: "c1", field: "tag", operator: "contains", value: "purchased" }],
        },
      },
      {
        id: "delay-24h",
        type: "delay",
        position: { x: 450, y: 600 },
        data: { label: "Wait 23 more hours", duration: 82800, unit: "seconds" },
      },
      {
        id: "msg-discount",
        type: "sendMessage",
        position: { x: 450, y: 750 },
        data: {
          label: "Discount code",
          text: "Last chance! 🔥 Here's 15% OFF just for you: **SAVE15**\n\nUse it at checkout before it expires! ⏰",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "delay-1h" },
      { id: "e2", source: "delay-1h", target: "msg-reminder" },
      { id: "e3", source: "msg-reminder", target: "condition-1" },
      { id: "e4", source: "condition-1", target: "delay-24h", sourceHandle: "false" },
      { id: "e5", source: "delay-24h", target: "msg-discount" },
    ],
  },
  {
    id: "order-status",
    name: "Order Status Updates",
    description:
      "Keep customers informed with real-time order confirmations, shipping notifications, and delivery confirmations.",
    category: "E-commerce",
    icon: Package,
    iconColor: "text-cyan-600",
    iconBg: "bg-cyan-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: {
          label: "Order keyword",
          triggerType: "keyword",
          config: { keywords: ["order", "tracking", "where is my"] },
        },
      },
      {
        id: "msg-confirm",
        type: "sendMessage",
        position: { x: 250, y: 150 },
        data: {
          label: "Order confirmed",
          text: "🎉 Order confirmed! Your order #{{order_id}} has been received and is being processed.",
        },
      },
      {
        id: "delay-ship",
        type: "delay",
        position: { x: 250, y: 300 },
        data: { label: "Wait for shipping (2 days)", duration: 172800, unit: "seconds" },
      },
      {
        id: "msg-shipped",
        type: "sendMessage",
        position: { x: 250, y: 450 },
        data: {
          label: "Shipped notification",
          text: "📦 Your order is on its way! Track your package here: {{tracking_link}}\n\nEstimated delivery: 3-5 business days.",
        },
      },
      {
        id: "delay-deliver",
        type: "delay",
        position: { x: 250, y: 600 },
        data: { label: "Wait for delivery (4 days)", duration: 345600, unit: "seconds" },
      },
      {
        id: "msg-delivered",
        type: "sendMessage",
        position: { x: 250, y: 750 },
        data: {
          label: "Delivery confirmation",
          text: "✅ Your order should be delivered by now! Enjoying it? Reply \"REVIEW\" to share your feedback and get 10% off your next order! 🌟",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "msg-confirm" },
      { id: "e2", source: "msg-confirm", target: "delay-ship" },
      { id: "e3", source: "delay-ship", target: "msg-shipped" },
      { id: "e4", source: "msg-shipped", target: "delay-deliver" },
      { id: "e5", source: "delay-deliver", target: "msg-delivered" },
    ],
  },
  {
    id: "review-request",
    name: "Review & Testimonial Request",
    description:
      "After purchase, automatically ask for a review. Route happy customers to leave a public review and unhappy ones to support.",
    category: "E-commerce",
    icon: Star,
    iconColor: "text-yellow-600",
    iconBg: "bg-yellow-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: {
          label: "Post-purchase trigger",
          triggerType: "keyword",
          config: { keywords: ["review", "feedback"] },
        },
      },
      {
        id: "msg-1",
        type: "sendMessage",
        position: { x: 250, y: 150 },
        data: {
          label: "Rating request",
          text: "Hi {{name}}! How would you rate your recent experience with us?\n\n⭐ 1-2 (Not great)\n⭐⭐⭐ 3 (Okay)\n⭐⭐⭐⭐⭐ 4-5 (Amazing!)",
        },
      },
      {
        id: "wait-rating",
        type: "smartDelay",
        position: { x: 250, y: 280 },
        data: { label: "Wait for rating", waitForInput: true, timeout: 600 },
      },
      {
        id: "condition-1",
        type: "condition",
        position: { x: 250, y: 400 },
        data: {
          label: "Happy customer?",
          conditions: [{ id: "c1", field: "last_message", operator: "contains", value: "4" }],
        },
      },
      {
        id: "msg-happy",
        type: "sendMessage",
        position: { x: 50, y: 560 },
        data: {
          label: "Leave public review",
          text: "That's amazing! 🎉 Would you mind leaving a quick review? It means the world to us!\n\n👉 https://g.page/your-business/review",
        },
      },
      {
        id: "msg-unhappy",
        type: "sendMessage",
        position: { x: 450, y: 560 },
        data: {
          label: "Escalate to support",
          text: "We're so sorry to hear that! 😔 Let us make it right. Our support team will reach out to you within 24 hours.",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "msg-1" },
      { id: "e2", source: "msg-1", target: "wait-rating" },
      { id: "e3", source: "wait-rating", target: "condition-1" },
      { id: "e4", source: "condition-1", target: "msg-happy", sourceHandle: "true" },
      { id: "e5", source: "condition-1", target: "msg-unhappy", sourceHandle: "false" },
    ],
  },

  // ─── ENGAGEMENT ───────────────────────────────────────────────
  {
    id: "re-engagement",
    name: "Win-Back Campaign",
    description:
      "Re-engage inactive subscribers who haven't interacted in 30+ days with a compelling offer and a personal touch.",
    category: "Engagement",
    icon: RefreshCw,
    iconColor: "text-teal-600",
    iconBg: "bg-teal-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: {
          label: "Inactive Trigger",
          triggerType: "keyword",
          config: { keywords: ["inactive", "winback"] },
        },
      },
      {
        id: "msg-1",
        type: "sendMessage",
        position: { x: 250, y: 150 },
        data: {
          label: "We miss you",
          text: "Hey {{name}}, we miss you! 😢 It's been a while since we last spoke. Is there anything we can help you with?",
        },
      },
      {
        id: "delay-1",
        type: "delay",
        position: { x: 250, y: 300 },
        data: { label: "Wait 3 days", duration: 259200, unit: "seconds" },
      },
      {
        id: "msg-offer",
        type: "sendMessage",
        position: { x: 250, y: 450 },
        data: {
          label: "Special offer",
          text: "Still there? 👋 Here's a special offer just for you — 20% OFF anything in our store: **COMEBACK20** 🎁\n\nOffer expires in 48 hours!",
        },
      },
      {
        id: "wait-reply",
        type: "smartDelay",
        position: { x: 250, y: 600 },
        data: { label: "Wait for reply", waitForInput: true, timeout: 172800 },
      },
      {
        id: "condition-replied",
        type: "condition",
        position: { x: 250, y: 730 },
        data: {
          label: "Did they reply?",
          conditions: [{ id: "c1", field: "has_replied", operator: "equals", value: "true" }],
        },
      },
      {
        id: "tag-active",
        type: "addTag",
        position: { x: 50, y: 880 },
        data: { label: "Tag: re-engaged", tagName: "re-engaged" },
      },
      {
        id: "tag-inactive",
        type: "addTag",
        position: { x: 450, y: 880 },
        data: { label: "Tag: churned", tagName: "churned" },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "msg-1" },
      { id: "e2", source: "msg-1", target: "delay-1" },
      { id: "e3", source: "delay-1", target: "msg-offer" },
      { id: "e4", source: "msg-offer", target: "wait-reply" },
      { id: "e5", source: "wait-reply", target: "condition-replied" },
      { id: "e6", source: "condition-replied", target: "tag-active", sourceHandle: "true" },
      { id: "e7", source: "condition-replied", target: "tag-inactive", sourceHandle: "false" },
    ],
  },
  {
    id: "referral-program",
    name: "Referral Program",
    description:
      "Turn your best customers into brand ambassadors. Give them a unique referral code and reward them when friends sign up.",
    category: "Engagement",
    icon: Users,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: {
          label: "Referral keyword",
          triggerType: "keyword",
          config: { keywords: ["refer", "referral", "invite friend"] },
        },
      },
      {
        id: "msg-1",
        type: "sendMessage",
        position: { x: 250, y: 150 },
        data: {
          label: "Explain program",
          text: "🤝 Our referral program is simple: share your unique link, and you both get rewarded!\n\nFor every friend who signs up, you get $10 credit. No limit!",
        },
      },
      {
        id: "set-ref",
        type: "setCustomField",
        position: { x: 250, y: 300 },
        data: {
          label: "Set referral code",
          fieldSlug: "referral_code",
          value: "REF_{{contact_id}}",
        },
      },
      {
        id: "msg-code",
        type: "sendMessage",
        position: { x: 250, y: 430 },
        data: {
          label: "Send referral link",
          text: "Here's your personal referral link, {{name}}! 🎯\n\nhttps://yourapp.com/signup?ref={{referral_code}}\n\nShare it and start earning!",
        },
      },
      {
        id: "tag-ambassador",
        type: "addTag",
        position: { x: 250, y: 560 },
        data: { label: "Tag: ambassador", tagName: "brand-ambassador" },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "msg-1" },
      { id: "e2", source: "msg-1", target: "set-ref" },
      { id: "e3", source: "set-ref", target: "msg-code" },
      { id: "e4", source: "msg-code", target: "tag-ambassador" },
    ],
  },
  {
    id: "loyalty-program",
    name: "Loyalty Rewards",
    description:
      "Identify VIP customers by purchase count, send them exclusive perks and a personalised thank-you message.",
    category: "Engagement",
    icon: Award,
    iconColor: "text-amber-600",
    iconBg: "bg-amber-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: {
          label: "Loyalty trigger",
          triggerType: "keyword",
          config: { keywords: ["points", "rewards", "loyalty", "vip"] },
        },
      },
      {
        id: "condition-vip",
        type: "condition",
        position: { x: 250, y: 150 },
        data: {
          label: "Is VIP?",
          conditions: [{ id: "c1", field: "purchase_count", operator: "greater_than", value: "5" }],
        },
      },
      {
        id: "msg-vip",
        type: "sendMessage",
        position: { x: 50, y: 330 },
        data: {
          label: "VIP welcome",
          text: "Welcome, VIP! 👑 You're one of our most valued customers. As a thank-you, here's your exclusive 30% OFF code: **VIP30**\n\nPlus, you get early access to all new products!",
        },
      },
      {
        id: "msg-standard",
        type: "sendMessage",
        position: { x: 450, y: 330 },
        data: {
          label: "Standard member",
          text: "Hi {{name}}! 🌟 You're part of our loyalty program. Make 3 more purchases to unlock VIP status and exclusive perks! You're {{purchases_remaining}} away!",
        },
      },
      {
        id: "tag-vip",
        type: "addTag",
        position: { x: 50, y: 490 },
        data: { label: "Tag: VIP", tagName: "vip" },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "condition-vip" },
      { id: "e2", source: "condition-vip", target: "msg-vip", sourceHandle: "true" },
      { id: "e3", source: "condition-vip", target: "msg-standard", sourceHandle: "false" },
      { id: "e4", source: "msg-vip", target: "tag-vip" },
    ],
  },

  // ─── AUTOMATION ───────────────────────────────────────────────
  {
    id: "event-reminder",
    name: "Event & Webinar Reminder",
    description:
      "Automate your event promotion: collect registrations, confirm instantly, send a 24h reminder, and a live link on the day.",
    category: "Automation",
    icon: Bell,
    iconColor: "text-purple-600",
    iconBg: "bg-purple-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: {
          label: "Register keyword",
          triggerType: "keyword",
          config: { keywords: ["register", "webinar", "event", "join"] },
        },
      },
      {
        id: "msg-confirm",
        type: "sendMessage",
        position: { x: 250, y: 150 },
        data: {
          label: "Registration confirmed",
          text: "🎉 You're registered for our upcoming webinar!\n\n📅 Date: {{event_date}}\n🕐 Time: {{event_time}}\n\nWe'll send you a reminder 24h before!",
        },
      },
      {
        id: "set-registered",
        type: "setCustomField",
        position: { x: 250, y: 300 },
        data: { label: "Mark as registered", fieldSlug: "event_registered", value: "true" },
      },
      {
        id: "delay-24h",
        type: "delay",
        position: { x: 250, y: 430 },
        data: { label: "Wait until 24h before", duration: 86400, unit: "seconds" },
      },
      {
        id: "msg-reminder",
        type: "sendMessage",
        position: { x: 250, y: 580 },
        data: {
          label: "24h reminder",
          text: "⏰ Reminder: Our webinar is tomorrow at {{event_time}}!\n\nHere's what we'll cover:\n✅ Topic 1\n✅ Topic 2\n✅ Topic 3\n\nSee you there!",
        },
      },
      {
        id: "delay-day",
        type: "delay",
        position: { x: 250, y: 730 },
        data: { label: "Wait until event day", duration: 82800, unit: "seconds" },
      },
      {
        id: "msg-live",
        type: "sendMessage",
        position: { x: 250, y: 880 },
        data: {
          label: "Live link",
          text: "🔴 We're LIVE! Join the webinar now:\n\n👉 {{live_link}}\n\nSee you inside, {{name}}!",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "msg-confirm" },
      { id: "e2", source: "msg-confirm", target: "set-registered" },
      { id: "e3", source: "set-registered", target: "delay-24h" },
      { id: "e4", source: "delay-24h", target: "msg-reminder" },
      { id: "e5", source: "msg-reminder", target: "delay-day" },
      { id: "e6", source: "delay-day", target: "msg-live" },
    ],
  },
  {
    id: "upsell-flow",
    name: "Upsell & Cross-sell",
    description:
      "After a purchase, intelligently recommend complementary products based on the customer's order, maximising revenue.",
    category: "Automation",
    icon: TrendingUp,
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: {
          label: "Purchase trigger",
          triggerType: "keyword",
          config: { keywords: ["purchased", "thank you for your order"] },
        },
      },
      {
        id: "delay-1",
        type: "delay",
        position: { x: 250, y: 150 },
        data: { label: "Wait 2 days", duration: 172800, unit: "seconds" },
      },
      {
        id: "msg-1",
        type: "sendMessage",
        position: { x: 250, y: 300 },
        data: {
          label: "Upsell message",
          text: "Hey {{name}}! 👋 Enjoying your purchase? Customers who bought that also loved these:\n\n🔥 Product A — $29\n💎 Product B — $49\n🚀 Bundle Deal — $65 (save $13!)",
        },
      },
      {
        id: "wait-reply",
        type: "smartDelay",
        position: { x: 250, y: 450 },
        data: { label: "Wait for interest", waitForInput: true, timeout: 86400 },
      },
      {
        id: "msg-offer",
        type: "sendMessage",
        position: { x: 250, y: 580 },
        data: {
          label: "Limited offer",
          text: "Still interested? Here's 10% off if you add it to your cart in the next 2 hours! ⏳\n\nUse code: **UPGRADE10**",
        },
      },
      {
        id: "tag-upsell",
        type: "addTag",
        position: { x: 250, y: 710 },
        data: { label: "Tag: upsell-targeted", tagName: "upsell-targeted" },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "delay-1" },
      { id: "e2", source: "delay-1", target: "msg-1" },
      { id: "e3", source: "msg-1", target: "wait-reply" },
      { id: "e4", source: "wait-reply", target: "msg-offer" },
      { id: "e5", source: "msg-offer", target: "tag-upsell" },
    ],
  },
  {
    id: "ai-customer-service",
    name: "AI Customer Service Bot",
    description:
      "Leverage AI to answer any customer question intelligently, with automatic escalation to a human if confidence is low.",
    category: "Automation",
    icon: Zap,
    iconColor: "text-yellow-600",
    iconBg: "bg-yellow-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: {
          label: "Any message",
          triggerType: "keyword",
          config: { keywords: ["?", "how", "what", "when", "where", "why", "can you"] },
        },
      },
      {
        id: "ai-1",
        type: "aiResponse",
        position: { x: 250, y: 150 },
        data: {
          label: "AI Answer",
          systemPrompt:
            "You are a helpful customer service assistant. Answer questions concisely and professionally. If you are unsure, say 'I'll connect you with a specialist.'",
          model: "openai/gpt-4o-mini",
          temperature: 0.3,
          maxTokens: 300,
          contextMessages: 5,
        },
      },
      {
        id: "condition-1",
        type: "condition",
        position: { x: 250, y: 320 },
        data: {
          label: "Needs human?",
          conditions: [
            { id: "c1", field: "ai_response", operator: "contains", value: "specialist" },
          ],
        },
      },
      {
        id: "tag-escalate",
        type: "addTag",
        position: { x: 50, y: 480 },
        data: { label: "Tag: needs-agent", tagName: "needs-agent" },
      },
      {
        id: "msg-end",
        type: "sendMessage",
        position: { x: 450, y: 480 },
        data: {
          label: "Satisfied?",
          text: "Was that helpful? Reply \"YES\" if you're all set, or ask another question! 😊",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "ai-1" },
      { id: "e2", source: "ai-1", target: "condition-1" },
      { id: "e3", source: "condition-1", target: "tag-escalate", sourceHandle: "true" },
      { id: "e4", source: "condition-1", target: "msg-end", sourceHandle: "false" },
    ],
  },
  {
    id: "phone-number-collector",
    name: "Phone Number Collector",
    description:
      "Seamlessly collect and validate phone numbers from contacts, then tag them for SMS marketing campaigns.",
    category: "Automation",
    icon: Phone,
    iconColor: "text-green-600",
    iconBg: "bg-green-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: {
          label: "Phone request trigger",
          triggerType: "keyword",
          config: { keywords: ["sms", "text me", "phone", "call me"] },
        },
      },
      {
        id: "msg-1",
        type: "sendMessage",
        position: { x: 250, y: 150 },
        data: {
          label: "Ask phone",
          text: "Sure! What's your phone number? (Include country code, e.g. +1 555 123 4567)",
        },
      },
      {
        id: "wait-phone",
        type: "smartDelay",
        position: { x: 250, y: 280 },
        data: { label: "Wait for phone", waitForInput: true, timeout: 300 },
      },
      {
        id: "set-phone",
        type: "setCustomField",
        position: { x: 250, y: 400 },
        data: { label: "Save phone", fieldSlug: "phone", value: "{{last_message}}" },
      },
      {
        id: "tag-sms",
        type: "addTag",
        position: { x: 250, y: 520 },
        data: { label: "Tag: sms-subscriber", tagName: "sms-subscriber" },
      },
      {
        id: "msg-confirm",
        type: "sendMessage",
        position: { x: 250, y: 640 },
        data: {
          label: "Confirmation",
          text: "✅ Perfect! We've saved your number. You'll receive exclusive SMS updates and deals. Reply STOP anytime to opt out.",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "msg-1" },
      { id: "e2", source: "msg-1", target: "wait-phone" },
      { id: "e3", source: "wait-phone", target: "set-phone" },
      { id: "e4", source: "set-phone", target: "tag-sms" },
      { id: "e5", source: "tag-sms", target: "msg-confirm" },
    ],
  },
  {
    id: "satisfaction-survey",
    name: "Customer Satisfaction Survey",
    description:
      "Run a quick NPS-style survey after a key touchpoint to measure satisfaction and route promoters vs detractors.",
    category: "Automation",
    icon: Heart,
    iconColor: "text-red-600",
    iconBg: "bg-red-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: {
          label: "Survey trigger",
          triggerType: "keyword",
          config: { keywords: ["survey", "nps", "rate us"] },
        },
      },
      {
        id: "msg-1",
        type: "sendMessage",
        position: { x: 250, y: 150 },
        data: {
          label: "NPS question",
          text: "Hi {{name}}! Quick question — on a scale of 0-10, how likely are you to recommend us to a friend?\n\n(Reply with a number)",
        },
      },
      {
        id: "wait-nps",
        type: "smartDelay",
        position: { x: 250, y: 280 },
        data: { label: "Wait for score", waitForInput: true, timeout: 600 },
      },
      {
        id: "set-nps",
        type: "setCustomField",
        position: { x: 250, y: 400 },
        data: { label: "Save NPS score", fieldSlug: "nps_score", value: "{{last_message}}" },
      },
      {
        id: "condition-1",
        type: "condition",
        position: { x: 250, y: 530 },
        data: {
          label: "Promoter (9-10)?",
          conditions: [{ id: "c1", field: "nps_score", operator: "greater_than", value: "8" }],
        },
      },
      {
        id: "msg-promoter",
        type: "sendMessage",
        position: { x: 50, y: 690 },
        data: {
          label: "Promoter path",
          text: "Wow, thank you! 🙌 Would you mind sharing a quick review? It really helps us grow!\n\n👉 https://g.page/review",
        },
      },
      {
        id: "msg-detractor",
        type: "sendMessage",
        position: { x: 450, y: 690 },
        data: {
          label: "Detractor path",
          text: "We're sorry to hear that! 😔 Your feedback means a lot. Can you tell us what we can do better? A team member will follow up personally.",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "msg-1" },
      { id: "e2", source: "msg-1", target: "wait-nps" },
      { id: "e3", source: "wait-nps", target: "set-nps" },
      { id: "e4", source: "set-nps", target: "condition-1" },
      { id: "e5", source: "condition-1", target: "msg-promoter", sourceHandle: "true" },
      { id: "e6", source: "condition-1", target: "msg-detractor", sourceHandle: "false" },
    ],
  },
];

const CATEGORIES = ["All", ...Array.from(new Set(templates.map((t) => t.category)))];

// --- Component ---

export function TemplatesView({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [creating, setCreating] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const pendingRef = useRef(false);

  async function handleUseTemplate(template: FlowTemplate) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setCreating(template.id);

    try {
      const res = await fetch("/api/v1/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: template.name,
          description: template.description,
          nodes: template.nodes,
          edges: template.edges,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create flow");
      }

      const flow = await res.json();
      router.push(`/dashboard/flows/${flow.id}`);
    } catch (err) {
      console.error("Failed to create flow from template:", err);
      pendingRef.current = false;
      setCreating(null);
    }
  }

  const filteredTemplates = templates.filter((t) => {
    const matchCat = activeCategory === "All" || t.category === activeCategory;
    const matchSearch =
      search === "" ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-8 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link
                href="/dashboard/flows"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Flows
              </Link>
            </div>
            <h1 className="text-2xl font-bold">Flow Templates</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {templates.length} ready-to-use flows — start with a template and customise it to your needs
            </p>
          </div>
          <button
            disabled
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2 text-sm font-medium text-muted-foreground cursor-not-allowed opacity-60"
            title="Coming soon"
          >
            <BookmarkPlus className="h-4 w-4" />
            Save Current Flow as Template
          </button>
        </div>

        {/* Search + filters */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates…"
              className="h-9 rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/50 w-56"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "rounded-full px-3.5 py-1 text-xs font-medium transition-colors",
                  activeCategory === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Template gallery */}
      <div className="flex-1 overflow-auto p-8">
        {filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="h-10 w-10 text-muted-foreground mb-4 opacity-40" />
            <p className="text-sm font-medium text-muted-foreground">No templates found</p>
            <p className="mt-1 text-xs text-muted-foreground">Try adjusting your search or filter</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredTemplates.map((template) => {
              const isCreating = creating === template.id;
              const Icon = template.icon;
              const nodeCount = template.nodes.length;

              return (
                <div
                  key={template.id}
                  className="group rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-md"
                >
                  {/* Icon + category */}
                  <div className="flex items-start justify-between">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg",
                        template.iconBg
                      )}
                    >
                      <Icon className={cn("h-5 w-5", template.iconColor)} />
                    </div>
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {template.category}
                    </span>
                  </div>

                  {/* Name + description */}
                  <h3 className="mt-4 text-sm font-semibold group-hover:text-primary transition-colors">
                    {template.name}
                  </h3>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed line-clamp-3">
                    {template.description}
                  </p>

                  {/* Node count */}
                  <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <GitBranch className="h-3 w-3" />
                    <span>
                      {nodeCount} {nodeCount === 1 ? "node" : "nodes"}
                    </span>
                  </div>

                  {/* Use template button */}
                  <button
                    onClick={() => handleUseTemplate(template)}
                    disabled={!!creating}
                    className="mt-4 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {isCreating ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Creating...
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5" />
                        Use Template
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
