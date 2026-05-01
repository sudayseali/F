import { createClient } from '@supabase/supabase-js';

const url = 'https://ovrjbuwfmfjcrhwmrrba.supabase.co'; // arbitrary url
const supabase = createClient(url, '');

async function test() {
  const { data, error } = await supabase.from('users').select('*').limit(1);
  console.log(error);
}
test();
