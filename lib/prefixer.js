const Tokenizer = require('css-selector-tokenizer');
const {
  parseAttrSelector,
  attrStringify,
  itMatchesOne,
} = require('./utils');


const prefixNode = (node, prefix) => {
  if (['class', 'id'].includes(node.type)) {
    return Object.assign({}, node, { name: `${prefix}${node.name}` });
  }

  if (['pseudo-class'].includes(node.type) && node.name === 'is' && node.content.includes('.group')) {
    const {
      type, operator, head, classes, foot,
    } = parseAttrSelector(node);

    return Object.assign({}, node, {
      content: attrStringify({
        type: type.split('.group').join(`.${prefix}group`),
        operator,
        head,
        classes,
        foot,
      }),
    });
  }

  if (['attribute'].includes(node.type) && node.content) {
    const {
      type, operator, head, classes, foot,
    } = parseAttrSelector(node);

    if (!['class', 'id'].includes(type)) return node;

    return Object.assign({}, node, {
      content: attrStringify({
        type,
        operator,
        head,
        classes: classes.map((cls) => `${prefix}${cls}`),
        foot,
      }),
    });
  }

  return node;
};

const interateSelectorNodes = (selector, options) => Object.assign({}, selector, {
  nodes: selector.nodes.map((node) => {
    if (['selector', 'nested-pseudo-class'].includes(node.type)) {
      return interateSelectorNodes(node, options);
    }

    if (itMatchesOne(options.ignore, Tokenizer.stringify(node))) return node;

    return prefixNode(node, options.prefix);
  }),
});


const prefixer = (options) => {
  const { prefix, ignore } = Object.assign({}, {
    prefix: '',
    ignore: [],
  }, options);

  if (typeof prefix !== 'string') {
    throw new Error('@postcss-prefix: prefix option should be of type string.');
  }

  if (!Array.isArray(ignore)) {
    throw new Error('@postcss-prefix: ignore options should be an Array.');
  }

  return {
    postcssPlugin: 'postcss-prefixer',
    Once(css) {
      const first = css.nodes[0];


      if (
        (first && first.type === 'rule' && first.selector.trim() === '.ignore-postcss-prefixer-plugin')
        || (first.parent.source.input.css.includes('@import')
          && first.parent.source.input.css.includes('node_modules')
        )
      ) {
        return;
      }
      if (!prefix.length) return;

      css.walkRules((rule) => {
        const parsed = Tokenizer.parse(rule.selector);
        const selector = interateSelectorNodes(parsed, { prefix, ignore });

        /* eslint no-param-reassign: "off" */
        rule.selector = Tokenizer.stringify(selector);
      });
    },
  };
};
prefixer.postcss = true;

module.exports = prefixer;
