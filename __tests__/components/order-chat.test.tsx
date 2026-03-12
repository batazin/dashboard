import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { OrderChat } from "@/components/orders/order-chat"
import { useSession } from "next-auth/react"

// Mock useSession
jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
}))

// Mock fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

describe("OrderChat Component", () => {
  const mockSession = {
    data: {
      user: {
        id: "user-1",
        name: "Test User",
        email: "test@example.com",
        image: null,
      },
    },
    status: "authenticated" as const,
  }

  const mockMessages = [
    {
      id: "msg-1",
      content: "Hello, how can I help?",
      createdAt: new Date().toISOString(),
      user: {
        id: "user-2",
        name: "Professional",
        image: null,
      },
    },
    {
      id: "msg-2",
      content: "I need help with my order",
      createdAt: new Date().toISOString(),
      user: {
        id: "user-1",
        name: "Test User",
        image: null,
      },
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    ;(useSession as jest.Mock).mockReturnValue(mockSession)
    
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/orders/") && url.includes("/messages")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockMessages),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      })
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("should render chat container", () => {
    render(<OrderChat orderId="order-1" />)

    // Chat should have the message input
    expect(screen.getByPlaceholderText(/digite sua mensagem/i)).toBeInTheDocument()
  })

  it("should display initial messages", () => {
    render(<OrderChat orderId="order-1" initialMessages={mockMessages} />)

    expect(screen.getByText("Hello, how can I help?")).toBeInTheDocument()
    expect(screen.getByText("I need help with my order")).toBeInTheDocument()
  })

  it("should display message input field", () => {
    render(<OrderChat orderId="order-1" />)

    expect(screen.getByPlaceholderText(/digite sua mensagem/i)).toBeInTheDocument()
  })

  it("should display send button", () => {
    render(<OrderChat orderId="order-1" />)

    const sendButton = screen.getByRole("button")
    expect(sendButton).toBeInTheDocument()
  })

  it("should allow typing in the input field", async () => {
    jest.useRealTimers()
    render(<OrderChat orderId="order-1" />)

    const input = screen.getByPlaceholderText(/digite sua mensagem/i)
    await userEvent.type(input, "New message")

    expect(input).toHaveValue("New message")
  })

  it("should send message when clicking send button", async () => {
    jest.useRealTimers()
    
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: "msg-new",
            content: "New message",
            createdAt: new Date().toISOString(),
            user: mockSession.data.user,
          }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockMessages),
      })
    })

    render(<OrderChat orderId="order-1" />)

    const input = screen.getByPlaceholderText(/digite sua mensagem/i)
    await userEvent.type(input, "New message")

    const sendButton = screen.getByRole("button")
    await userEvent.click(sendButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/orders/order-1/messages"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("New message"),
        })
      )
    })
  })

  it("should clear input after sending message", async () => {
    jest.useRealTimers()
    
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: "msg-new",
            content: "New message",
            createdAt: new Date().toISOString(),
            user: mockSession.data.user,
          }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockMessages),
      })
    })

    render(<OrderChat orderId="order-1" />)

    const input = screen.getByPlaceholderText(/digite sua mensagem/i)
    await userEvent.type(input, "New message")
    
    const sendButton = screen.getByRole("button")
    await userEvent.click(sendButton)

    await waitFor(() => {
      expect(input).toHaveValue("")
    })
  })

  it("should not send empty message", async () => {
    jest.useRealTimers()
    render(<OrderChat orderId="order-1" />)

    const sendButton = screen.getByRole("button")
    await userEvent.click(sendButton)

    // POST should not be called for empty message
    const postCalls = mockFetch.mock.calls.filter(
      (call) => call[1]?.method === "POST"
    )
    expect(postCalls).toHaveLength(0)
  })

  it("should display empty state message when no messages", () => {
    render(<OrderChat orderId="order-1" initialMessages={[]} />)

    expect(screen.getByText(/nenhuma mensagem ainda/i)).toBeInTheDocument()
  })

  it("should show user initials in avatar", () => {
    render(<OrderChat orderId="order-1" initialMessages={mockMessages} />)

    // Should show initials when no avatar image
    expect(screen.getByText("P")).toBeInTheDocument() // Professional
    expect(screen.getByText("T")).toBeInTheDocument() // Test User
  })

  it("should poll for new messages", async () => {
    render(<OrderChat orderId="order-1" />)

    // Fast-forward 3 seconds to trigger polling
    jest.advanceTimersByTime(3000)

    await waitFor(() => {
      // Should fetch messages after interval
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/orders/order-1/messages")
      )
    })
  })
})
