/** Routes where coordinators edit floor plans and need the layout help entry in site chrome. */
export function isCoordinatorLayoutHelpNavRoute(pathname: string): boolean {
  return (
    pathname === '/coordinator/dashboard' ||
    pathname.startsWith('/coordinator/dashboard/')
  )
}
