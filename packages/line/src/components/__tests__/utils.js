import Sociably from '@sociably/core';
import Renderer from '@sociably/core/renderer';

// eslint-disable-next-line import/prefer-default-export
export const renderInner = async (node) => {
  let rendered;
  const renderer = new Renderer('line', async (_, __, render) => {
    rendered = await render(node);
    return null;
  });

  await renderer.render(<container />);
  return rendered;
};
