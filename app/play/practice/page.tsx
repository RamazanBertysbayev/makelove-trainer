import Trainer from '@/app/_components/Trainer';
export default function Page() {
  return <Trainer title="Свободная практика" kinds={['assemble','quiz','find_error','compare']} mode="free" chooseKinds />;
}
