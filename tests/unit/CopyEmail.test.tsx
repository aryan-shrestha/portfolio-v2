import { afterEach, describe, expect, test, vi } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CopyEmail } from '@/components/ui/CopyEmail'
import { site } from '@/lib/site'

const mailto = `mailto:${site.email}`

// userEvent.setup() installs its own clipboard stub, so call setClipboard after it.
function setClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true })
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('CopyEmail', () => {
  test('click copies the address and shows the confirmation', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const onCopied = vi.fn()
    const user = userEvent.setup()
    setClipboard({ writeText })
    render(<CopyEmail email={site.email} onCopied={onCopied} />)

    await user.click(screen.getByRole('button', { name: new RegExp(site.email) }))

    expect(writeText).toHaveBeenCalledWith(site.email)
    const status = await screen.findByRole('status')
    expect(status.textContent).toBe('Copied! Talk soon.')
    const link = screen.getByRole('link')
    expect(status.contains(link)).toBe(false)
    expect(onCopied).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('link').getAttribute('href')).toBe(mailto)
  })

  test('confirmation disappears after 2 s', async () => {
    setClipboard({ writeText: vi.fn().mockResolvedValue(undefined) })
    vi.useFakeTimers()
    render(<CopyEmail email={site.email} />)

    await act(async () => {
      screen.getByRole('button').click()
    })
    expect(screen.getByText('Copied! Talk soon.')).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.queryByText('Copied! Talk soon.')).toBeNull()
  })

  test('without navigator.clipboard the click does not throw and the mailto link is present', async () => {
    const rejections: unknown[] = []
    const onRej = (r: unknown) => rejections.push(r)
    process.on('unhandledRejection', onRej)
    const user = userEvent.setup()
    setClipboard(undefined)
    render(<CopyEmail email={site.email} />)

    await user.click(screen.getByRole('button'))
    await new Promise((r) => setTimeout(r, 10))

    process.off('unhandledRejection', onRej)
    expect(rejections).toEqual([])
    expect(screen.getByRole('link').getAttribute('href')).toBe(mailto)
    expect(screen.queryByText('Copied! Talk soon.')).toBeNull()
  })

  test('when writeText rejects the same fallback applies', async () => {
    const rejections: unknown[] = []
    const onRej = (r: unknown) => rejections.push(r)
    process.on('unhandledRejection', onRej)
    const onCopied = vi.fn()
    const user = userEvent.setup()
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) })
    render(<CopyEmail email={site.email} onCopied={onCopied} />)

    await user.click(screen.getByRole('button'))
    await new Promise((r) => setTimeout(r, 10))

    process.off('unhandledRejection', onRej)
    expect(rejections).toEqual([])
    expect(onCopied).not.toHaveBeenCalled()
    expect(screen.getByRole('link').getAttribute('href')).toBe(mailto)
    expect(screen.queryByText('Copied! Talk soon.')).toBeNull()
  })
})
