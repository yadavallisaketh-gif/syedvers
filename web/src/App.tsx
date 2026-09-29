import { useEffect } from 'react'

import { SimulationLayout } from './layout/SimulationLayout'
import { useSim } from './sim/store'
import { useHotkeys } from './sim/useHotkeys'

export default function App() {
  useHotkeys()
  useEffect(() => {
    void useSim.getState().init()
  }, [])
  return <SimulationLayout />
}
