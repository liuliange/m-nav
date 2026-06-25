import { siteConfig } from '@/config/site'

export function SiteFooter() {
  return (
    <footer className="border-grid border-t py-6 md:py-0">
      <div className="container-wrapper">
        <div className="container py-4">
          <div className="text-balance text-center text-sm leading-loose text-muted-foreground md:text-left flex justify-between">
            <span>
              2024 特卖团{' '}
              <a
                href={siteConfig.links.homepage}
                target="_blank"
                rel="noreferrer"
                className="font-medium underline underline-offset-4"
              >
                All rights reserved
              </a>
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
