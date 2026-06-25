import Image from 'next/image'
import logoImage from '@/assets/images/logo.png'

export const Logo = ({ className }: { className?: string }) => {
  return <Image src={logoImage} alt="Logo" className={className} />
}
