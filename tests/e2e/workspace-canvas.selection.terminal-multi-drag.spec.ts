import { expect, test, type Page } from '@playwright/test'
import { clearAndSeedWorkspace, launchApp, readCanvasViewport, storageKey } from './workspace-canvas.helpers'

test.describe('Workspace Canvas - Selection (Terminal Multi Drag)', () => {
  const readNodePositions = async (
    window: Page,
  ): Promise<{ left: { x: number; y: number }; right: { x: number; y: number } } | null> => {
    return await window.evaluate(async key => {
      void key

      const raw = await window.coveApi.persistence.readWorkspaceStateRaw()
      if (!raw) {
        return null
      }

      const state = JSON.parse(raw) as {
        workspaces?: Array<{
          nodes?: Array<{
            id?: string
            position?: { x?: number; y?: number }
          }>
        }>
      }

      const nodes = state.workspaces?.[0]?.nodes ?? []
      const leftNode = nodes.find(entry => entry.id === 'terminal-multi-left')
      const rightNode = nodes.find(entry => entry.id === 'terminal-multi-right')

      if (
        !leftNode?.position ||
        typeof leftNode.position.x !== 'number' ||
        typeof leftNode.position.y !== 'number' ||
        !rightNode?.position ||
        typeof rightNode.position.x !== 'number' ||
        typeof rightNode.position.y !== 'number'
      ) {
        return null
      }

      return {
        left: { x: leftNode.position.x, y: leftNode.position.y },
        right: { x: rightNode.position.x, y: rightNode.position.y },
      }
    }, storageKey)
  }

  test('drags multi-selected terminals after shift-click selection', async () => {
    const { electronApp, window } = await launchApp()

    try {
      await clearAndSeedWorkspace(
        window,
        [
          {
            id: 'terminal-multi-left',
            title: 'terminal-multi-drag-left',
            position: { x: 220, y: 180 },
            width: 460,
            height: 300,
          },
          {
            id: 'terminal-multi-right',
            title: 'terminal-multi-drag-right',
            position: { x: 760, y: 180 },
            width: 460,
            height: 300,
          },
        ],
        {
          settings: {
            canvasInputMode: 'mouse',
          },
        },
      )

      const leftTerminal = window
        .locator('.terminal-node')
        .filter({ hasText: 'terminal-multi-drag-left' })
        .first()
      const rightTerminal = window
        .locator('.terminal-node')
        .filter({ hasText: 'terminal-multi-drag-right' })
        .first()
      await expect(leftTerminal).toBeVisible()
      await expect(rightTerminal).toBeVisible()

      const leftBody = leftTerminal.locator('.terminal-node__terminal')
      const rightBody = rightTerminal.locator('.terminal-node__terminal')
      const leftHeader = leftTerminal.locator('.terminal-node__header')
      const rightHeader = rightTerminal.locator('.terminal-node__header')

      await leftHeader.click({ position: { x: 40, y: 20 } })
      await rightHeader.click({ position: { x: 40, y: 20 }, modifiers: ['Shift'] })

      await expect(window.locator('.react-flow__node.selected')).toHaveCount(2)
      await expect(window.locator('.react-flow__nodesselection-rect')).toHaveCount(1)

      const rightOverlay = rightTerminal.locator(
        '[data-testid="terminal-node-selected-drag-overlay"]',
      )
      await expect(rightOverlay).toBeVisible()

      const before = await readNodePositions(window)
      if (!before) {
        throw new Error('node positions unavailable before multi-drag')
      }

      const beforeViewport = await readCanvasViewport(window)

      const pane = window.locator('.workspace-canvas .react-flow__pane')
      await expect(pane).toBeVisible()
      const paneBox = await pane.boundingBox()
      const overlayBox = await rightOverlay.boundingBox()
      if (!paneBox || !overlayBox) {
        throw new Error('overlay/pane bounding box unavailable for multi-drag')
      }

      const beforeLeftBox = await leftTerminal.boundingBox()
      const beforeRightBox = await rightTerminal.boundingBox()
      if (!beforeLeftBox || !beforeRightBox) {
        throw new Error('terminal bounding boxes unavailable before multi-drag')
      }

      const startX = Math.min(paneBox.x + paneBox.width - 40, overlayBox.x + 140)
      const startY = overlayBox.y + 120
      const endX = Math.min(paneBox.x + paneBox.width - 60, startX + 240)
      const endY = Math.min(paneBox.y + paneBox.height - 60, startY + 220)

      const dragHitTarget = await window.evaluate(
        ({ x, y }) => {
          const el = document.elementFromPoint(x, y)
          if (!el) {
            return null
          }

          return {
            tagName: el.tagName,
            className: el.className,
            testId: el.getAttribute('data-testid'),
            hasNoDragAncestor: Boolean(el.closest('.nodrag')),
          }
        },
        { x: startX, y: startY },
      )
      console.log('multi-drag hit target', { startX, startY, dragHitTarget })

      await window.waitForTimeout(150)

      await window.mouse.move(startX, startY)
      await window.mouse.down()
      await window.mouse.move(endX, endY, { steps: 12 })
      await window.mouse.up()

      const afterViewport = await readCanvasViewport(window)
      console.log('multi-drag viewport delta', {
        x: afterViewport.x - beforeViewport.x,
        y: afterViewport.y - beforeViewport.y,
        zoom: afterViewport.zoom - beforeViewport.zoom,
      })

      const afterLeftBox = await leftTerminal.boundingBox()
      const afterRightBox = await rightTerminal.boundingBox()
      if (afterLeftBox && afterRightBox) {
        console.log('multi-drag box delta', {
          left: { x: afterLeftBox.x - beforeLeftBox.x, y: afterLeftBox.y - beforeLeftBox.y },
          right: { x: afterRightBox.x - beforeRightBox.x, y: afterRightBox.y - beforeRightBox.y },
        })
      }

      await expect
        .poll(async () => {
          const after = await readNodePositions(window)
          if (!after) {
            return Number.NaN
          }

          return Math.hypot(after.right.x - before.right.x, after.right.y - before.right.y)
        })
        .toBeGreaterThan(120)

      await expect
        .poll(async () => {
          const after = await readNodePositions(window)
          if (!after) {
            return Number.NaN
          }

          return Math.hypot(after.left.x - before.left.x, after.left.y - before.left.y)
        })
        .toBeGreaterThan(120)
    } finally {
      await electronApp.close()
    }
  })

  test('drags multi-selected terminals after sequential shift marquee selection', async () => {
    const { electronApp, window } = await launchApp()

    try {
      await clearAndSeedWorkspace(
        window,
        [
          {
            id: 'terminal-multi-left',
            title: 'terminal-multi-marquee-left',
            position: { x: 220, y: 180 },
            width: 460,
            height: 300,
          },
          {
            id: 'terminal-multi-right',
            title: 'terminal-multi-marquee-right',
            position: { x: 760, y: 180 },
            width: 460,
            height: 300,
          },
        ],
        {
          settings: {
            canvasInputMode: 'mouse',
          },
        },
      )

      const pane = window.locator('.workspace-canvas .react-flow__pane')
      await expect(pane).toBeVisible()
      const paneBox = await pane.boundingBox()
      if (!paneBox) {
        throw new Error('workspace pane bounding box unavailable for marquee selection')
      }

      const leftTerminal = window
        .locator('.terminal-node')
        .filter({ hasText: 'terminal-multi-marquee-left' })
        .first()
      const rightTerminal = window
        .locator('.terminal-node')
        .filter({ hasText: 'terminal-multi-marquee-right' })
        .first()
      await expect(leftTerminal).toBeVisible()
      await expect(rightTerminal).toBeVisible()

      const leftBox = await leftTerminal.boundingBox()
      const rightBox = await rightTerminal.boundingBox()
      if (!leftBox || !rightBox) {
        throw new Error('terminal bounding box unavailable for marquee selection')
      }

      const selectNodeByMarquee = async (targetBox: NonNullable<typeof leftBox>) => {
        const startX = Math.max(paneBox.x + 40, targetBox.x - 24)
        const startY = Math.max(paneBox.y + 40, targetBox.y - 24)
        const endX = Math.min(
          paneBox.x + paneBox.width - 40,
          targetBox.x + targetBox.width - 24,
        )
        const endY = Math.min(
          paneBox.y + paneBox.height - 120,
          targetBox.y + targetBox.height - 24,
        )

        await window.keyboard.down('Shift')
        await window.mouse.move(startX, startY)
        await window.mouse.down()
        await window.mouse.move(endX, endY, { steps: 10 })
        await expect(window.locator('.workspace-selection-draft')).toBeVisible()
        await window.mouse.up()
        await window.keyboard.up('Shift')
        await expect(window.locator('.workspace-selection-draft')).toHaveCount(0)
      }

      await pane.click({ position: { x: 40, y: 40 } })
      await selectNodeByMarquee(leftBox)
      await selectNodeByMarquee(rightBox)

      await expect(window.locator('.react-flow__node.selected')).toHaveCount(2)

      const rightOverlay = rightTerminal.locator('[data-testid="terminal-node-selected-drag-overlay"]')
      await expect(rightOverlay).toBeVisible()

      const before = await readNodePositions(window)
      if (!before) {
        throw new Error('node positions unavailable before multi-drag')
      }

      const overlayBox = await rightOverlay.boundingBox()
      if (!overlayBox) {
        throw new Error('overlay bounding box unavailable for multi-drag')
      }

      const startX = overlayBox.x + 140
      const startY = overlayBox.y + 120
      const endX = Math.min(paneBox.x + paneBox.width - 60, startX + 240)
      const endY = Math.min(paneBox.y + paneBox.height - 60, startY + 220)

      await window.mouse.move(startX, startY)
      await window.mouse.down()
      await window.mouse.move(endX, endY, { steps: 12 })
      await window.mouse.up()

      await expect
        .poll(async () => {
          const after = await readNodePositions(window)
          if (!after) {
            return Number.NaN
          }

          return Math.hypot(after.right.x - before.right.x, after.right.y - before.right.y)
        })
        .toBeGreaterThan(120)

      await expect
        .poll(async () => {
          const after = await readNodePositions(window)
          if (!after) {
            return Number.NaN
          }

          return Math.hypot(after.left.x - before.left.x, after.left.y - before.left.y)
        })
        .toBeGreaterThan(120)
    } finally {
      await electronApp.close()
    }
  })
})
