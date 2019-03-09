import { RestController, Get } from '@gabliam/web-core';


@RestController('/')
export class HelloController {
  @Get('/hello')
  sayHello() {
    return 'Hello';
  }
}
