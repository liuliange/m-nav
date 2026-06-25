import Link from 'next/link';

import { siteConfig } from '@/config/site';
import { MainNav } from '@/components/header/main-nav';
import { ModeSwitcher } from '@/components/header/mode-switcher';
import { Button } from '@m-nav/ui/components/button';
import { Weibo } from 'lucide-react';
import { Search } from './header/Search';

export function SiteHeader({ title }: { title?: string }) {
  return (
    <header className='border-grid sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
      <div className='container-wrapper'>
        <div className='container flex h-14 items-center gap-2 md:gap-4'>
          <MainNav title={title} />
          <div className='ml-auto flex items-center gap-2 flex-1 justify-end'>
            <nav className='flex items-center gap-0.5'>
              <Search />
              <Button
                asChild
                variant='ghost'
                size='icon'
                className='h-8 w-8 px-0'
              >
                <Link href={siteConfig.links.weibo} target='_blank' rel='noreferrer'>
                  <Weibo className='size-4' />
                  <span className='sr-only'>微博</span>
                </Link>
              </Button>
              <ModeSwitcher />
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
