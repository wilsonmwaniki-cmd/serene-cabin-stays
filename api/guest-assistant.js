import {
  fetchActiveRestaurantMenuItems,
  fetchPodAvailability,
  fetchPods,
  fetchSiteContent,
} from "./_lib/supabase-admin.js";

const OPENAI_URL = "https://api.openai.com/v1/responses";
const MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";
const TIMEZONE = "Africa/Nairobi";

const getBusinessContext = async () => {
  const [pods, contentRows, menuItems] = await Promise.all([
    fetchPods(),
    fetchSiteContent(),
    fetchActiveRestaurantMenuItems(),
  ]);

  const content = Object.fromEntries(contentRows.map((row) => [row.key, row.value]));

  return {
    content,
    pods: pods.map((pod) => ({
      id: pod.id,
      slug: pod.slug,
      name: pod.name,
      description: pod.description,
      price_kes: pod.price_kes,
      surcharge_kes: pod.surcharge_kes ?? 0,
      total_units: pod.total_units,
      capacity: pod.capacity,
      amenities: Array.isArray(pod.amenities) ? pod.amenities : [],
    })),
    menuItems: menuItems.map((item) => ({
      title: item.title,
      section: item.section,
      price_kes: item.price_kes,
      description: item.description ?? "",
    })),
  };
};

const buildBusinessPrompt = ({ currentPath, context }) => {
  const intro = {
    property_name: context.content["home.hero.title"] || "Wild by LERA",
    location: context.content["contact.address"] || "Elementaita, Kenya",
    contact_email: context.content["contact.email"] || "bookings@lera.co.ke",
    contact_phone: context.content["contact.phone"] || "+254725744695",
    till_number: "3128049",
    booking_rules: {
      min_stay_nights: 2,
      max_stay_nights: 30,
      booking_window: "Guests can book up to 12 months in advance.",
      occupancy: "Each cabin holds a maximum of 2 guests.",
      children_under_12: "Half price",
      guests_12_plus: "Full price",
      payment: "Bookings are reviewed first, then guests can pay by M-Pesa till or prompt.",
    },
  };

  return [
    "You are the guest booking assistant for Wild by LERA.",
    "Your job is to help guests understand the site, choose pods, understand pricing and policies, and guide them into booking.",
    "Answer only from the supplied business context and tool outputs. If something is not in the context, say so briefly and offer the nearest useful next step.",
    "Keep replies warm, simple, and concise.",
    "When helpful, include markdown links with relative URLs like [Book now](/book), [View stays](/stays), [Restaurant menu](/restaurant), or [Contact us](/contact).",
    "Never claim a booking is confirmed. Explain that booking requests are reviewed by the host.",
    "If a guest provides dates and asks about availability, use the availability tool.",
    "If a guest is ready to book, use the booking-link tool so you can give them a direct booking link.",
    `The guest is currently on: ${currentPath || "/"}.`,
    "",
    "Business context:",
    JSON.stringify({ intro, pods: context.pods, menuItems: context.menuItems }, null, 2),
  ].join("\n");
};

const buildBookingLink = ({
  pod_slug,
  check_in,
  check_out,
  rooms,
  adults,
  children_under_12,
  children_12_plus,
}) => {
  const params = new URLSearchParams();
  if (check_in) params.set("in", check_in);
  if (check_out) params.set("out", check_out);
  if (rooms) params.set("rooms", String(rooms));
  if (adults) params.set("adults", String(adults));
  if (children_under_12) params.set("children", String(children_under_12));
  if (children_12_plus) params.set("children12plus", String(children_12_plus));

  const path = pod_slug ? `/book/${pod_slug}` : "/book";
  return `${path}${params.toString() ? `?${params.toString()}` : ""}`;
};

const assistantTools = [
  {
    type: "function",
    name: "check_pod_availability",
    description: "Check current unit availability for one pod or all pods over a date range.",
    parameters: {
      type: "object",
      properties: {
        check_in: { type: "string", description: "Check-in date in YYYY-MM-DD format." },
        check_out: { type: "string", description: "Check-out date in YYYY-MM-DD format." },
        pod_slug: { type: "string", description: "Optional pod slug such as glamping-pod-1 or glamping-pod-2." },
        requested_rooms: { type: "number", description: "Optional number of rooms requested." },
      },
      required: ["check_in", "check_out"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "create_booking_link",
    description: "Build a direct booking link using the guest's chosen dates, guests, rooms, and optional pod.",
    parameters: {
      type: "object",
      properties: {
        pod_slug: { type: "string", description: "Optional pod slug such as glamping-pod-1 or glamping-pod-2." },
        check_in: { type: "string", description: "Check-in date in YYYY-MM-DD format." },
        check_out: { type: "string", description: "Check-out date in YYYY-MM-DD format." },
        rooms: { type: "number", description: "Number of rooms." },
        adults: { type: "number", description: "Number of adults." },
        children_under_12: { type: "number", description: "Number of children under 12." },
        children_12_plus: { type: "number", description: "Number of guests aged 12 and above." },
      },
      required: [],
      additionalProperties: false,
    },
  },
];

const normalizeMessages = (messages) =>
  (Array.isArray(messages) ? messages : [])
    .filter((message) => message && (message.role === "user" || message.role === "assistant") && typeof message.content === "string")
    .slice(-12)
    .map((message) => ({
      role: message.role,
      content: [{ type: "input_text", text: message.content }],
    }));

const extractOutputText = (responseJson) => {
  if (typeof responseJson.output_text === "string" && responseJson.output_text.trim()) {
    return responseJson.output_text.trim();
  }

  const parts = [];
  for (const item of responseJson.output ?? []) {
    if (item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const chunk of item.content) {
      if (chunk.type === "output_text" && typeof chunk.text === "string") {
        parts.push(chunk.text);
      }
      if (chunk.type === "text" && typeof chunk.text === "string") {
        parts.push(chunk.text);
      }
    }
  }

  return parts.join("\n").trim();
};

const createOpenAIResponse = async ({ instructions, input, tools }) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI is not configured");
  }

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      input,
      instructions,
      tools,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || "OpenAI request failed");
  }

  return data;
};

const executeToolCall = async ({ call, context }) => {
  const args = JSON.parse(call.arguments || "{}");

  if (call.name === "create_booking_link") {
    return {
      call_id: call.call_id,
      output: JSON.stringify({
        booking_link: buildBookingLink(args),
      }),
    };
  }

  if (call.name === "check_pod_availability") {
    const matchingPods = args.pod_slug
      ? context.pods.filter((pod) => pod.slug === args.pod_slug)
      : context.pods;

    const results = await Promise.all(
      matchingPods.map(async (pod) => {
        const availability = await fetchPodAvailability({
          podId: pod.id,
          checkIn: args.check_in,
          checkOut: args.check_out,
        });

        return {
          pod_slug: pod.slug,
          pod_name: pod.name,
          requested_rooms: Number(args.requested_rooms || 0) || null,
          units_available: availability?.units_available ?? 0,
          units_total: availability?.units_total ?? pod.total_units,
          can_fit_request: args.requested_rooms
            ? (availability?.units_available ?? 0) >= Number(args.requested_rooms)
            : null,
        };
      }),
    );

    return {
      call_id: call.call_id,
      output: JSON.stringify({
        check_in: args.check_in,
        check_out: args.check_out,
        availability: results,
      }),
    };
  }

  return {
    call_id: call.call_id,
    output: JSON.stringify({ error: `Unknown tool: ${call.name}` }),
  };
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { messages = [], currentPath = "/" } = req.body || {};
    const context = await getBusinessContext();
    const instructions = buildBusinessPrompt({ currentPath, context });

    let input = normalizeMessages(messages);
    if (input.length === 0) {
      input = [{ role: "user", content: [{ type: "input_text", text: "Say hello and explain how you can help a guest book." }] }];
    }

    let responseJson = await createOpenAIResponse({
      instructions,
      input,
      tools: assistantTools,
    });

    for (let i = 0; i < 3; i += 1) {
      const functionCalls = (responseJson.output ?? []).filter((item) => item.type === "function_call");
      if (functionCalls.length === 0) break;

      const toolOutputs = await Promise.all(functionCalls.map((call) => executeToolCall({ call, context })));
      input = [...input, ...(responseJson.output ?? []), ...toolOutputs.map((tool) => ({
        type: "function_call_output",
        call_id: tool.call_id,
        output: tool.output,
      }))];

      responseJson = await createOpenAIResponse({
        instructions,
        input,
        tools: assistantTools,
      });
    }

    const reply = extractOutputText(responseJson);
    return res.status(200).json({
      reply: reply || "I’m here to help with stays, pricing, availability, and booking links.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Assistant could not respond";
    return res.status(500).json({ error: message });
  }
}
