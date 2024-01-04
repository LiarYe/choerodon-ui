import React, {
  Children,
  cloneElement,
  FunctionComponent,
  isValidElement,
  ReactElement,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { isArrayLike } from 'mobx';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import isNil from 'lodash/isNil';
import ConfigContext from 'choerodon-ui/lib/config-provider/ConfigContext';
import FormContext from './FormContext';
import { defaultLabelWidth, FIELD_SUFFIX, getProperty, normalizeLabelWidth, getPropertyDSFirst, getRequiredMarkAlign } from './utils';
import { LabelLayout } from './enum';
import { FormFieldProps } from '../field/FormField';
import Row from '../row';
import Col from '../col';
import { Tooltip as LabelTooltip } from '../core/enum';
import { hide, show } from '../tooltip/singleton';
import { TooltipProps } from '../tooltip/Tooltip';
import isOverflow from '../overflow-tip/util';
import { ShowHelp } from '../field/enum';
import Icon from '../icon';

export interface ItemProps extends FormFieldProps {
  children: ReactElement<FormFieldProps>;
}

export interface LabelProps {
  className?: string;
  children?: ReactNode;
  tooltip?: LabelTooltip | [LabelTooltip, TooltipProps];
  width?: number;
  help?: ReactNode;
  labelWordBreak?: boolean;
}

export interface LabelHelpProps {
  help?: ReactNode;
}

export interface IItem extends FunctionComponent<ItemProps> {
  __PRO_FORM_ITEM?: boolean;
}

const Label: FunctionComponent<LabelProps> = (props) => {
  const { children, className, tooltip, width, help, labelWordBreak } = props;
  const { getTooltipTheme, getTooltipPlacement } = useContext(ConfigContext);
  const tooltipRef = useRef<boolean>(false);
  const style = useMemo(() => width ? ({ width }) : undefined, [width]);
  const handleMouseEnter = useCallback((e) => {
    const { currentTarget } = e;
    if (tooltip === LabelTooltip.always || (tooltip === LabelTooltip.overflow && !labelWordBreak && isOverflow(currentTarget))) {
      show(currentTarget, {
        title: children,
        theme: getTooltipTheme('label'),
        placement: getTooltipPlacement('label'),
      });
      tooltipRef.current = true;
    } else if (isArrayLike(tooltip)) {
      const tooltipType = tooltip[0];
      const labelTooltipProps = tooltip[1] || {};
      const duration: number = (labelTooltipProps.mouseEnterDelay || 0.1) * 1000;
      if (tooltipType === LabelTooltip.always || (tooltipType === LabelTooltip.overflow && !labelWordBreak && isOverflow(currentTarget))) {
        show(currentTarget, {
          theme: getTooltipTheme('label'),
          placement: getTooltipPlacement('label'),
          title: labelTooltipProps.title ? labelTooltipProps.title : children,
          ...labelTooltipProps,
        }, duration);
        tooltipRef.current = true;
      }
    }
  }, [children, tooltip, tooltipRef]);
  const handleMouseLeave = useCallback(() => {
    if (tooltipRef.current) {
      hide();
      tooltipRef.current = false;
    }
  }, [tooltipRef]);
  useEffect(() => () => {
    if (tooltipRef.current) {
      hide();
      tooltipRef.current = false;
    }
  }, [tooltipRef]);
  return (
    <label
      className={className}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={style}
    >
      {children}
      {help}
    </label>
  );
};

Label.displayName = 'Label';

const LabelHelp: FunctionComponent<LabelHelpProps> = (props) => {
  const { help } = props;
  const { getTooltipTheme, getTooltipPlacement } = useContext(ConfigContext);
  const tooltipRef = useRef<boolean>(false);
  useEffect(() => {
    return () => {
      if (tooltipRef.current) {
        hide();
        tooltipRef.current = false;
      }
    };
  }, []);

  const handleHelpMouseEnter = useCallback((e, help) => {
    const { target } = e;
    show(target as HTMLElement, {
      title: help,
      theme: getTooltipTheme('help'),
      placement: getTooltipPlacement('help'),
    });
    tooltipRef.current = true;
  }, []);
  const handleHelpMouseLeave = useCallback(() => {
    hide();
    tooltipRef.current = false;
  }, []);

  if (help) {
    return (
      <Icon
        type="help"
        onMouseEnter={(e) => handleHelpMouseEnter(e, help)}
        onMouseLeave={handleHelpMouseLeave}
      />
    );
  }
  return null;
}

LabelHelp.displayName = 'LabelHelp';

const Item: IItem = observer((props: ItemProps): ReactElement<any> | null => {
  const { getConfig, dataSet, record, labelLayout = getConfig('labelLayout'), labelAlign,
    labelWidth: contextLabelWidth = defaultLabelWidth, labelTooltip, useColon, requiredMarkAlign, getProPrefixCls,
    showHelp, labelWordBreak: contextLabelWordBreak } = useContext(FormContext);
  const { children, useColon: fieldUseColon = useColon, requiredMarkAlign: fieldRequiredMarkAlign = requiredMarkAlign, ...rest } = props;
  const child = Children.only<ReactElement<FormFieldProps>>(children);
  if (isValidElement<FormFieldProps>(child)) {
    const prefixCls = getProPrefixCls(FIELD_SUFFIX);
    const { props: childrenProps } = child;
    const { className, fieldClassName, ...otherProps } = childrenProps;
    const fieldProps: FormFieldProps = { ...rest, ...otherProps };
    const fieldElementProps: any = {
      className: classNames(props.className, className, prefixCls),
      ...fieldProps,
    };
    const intlFieldOutput = (child.type as any).displayName === 'IntlField' && (fieldProps as any).displayOutput;
    if ([LabelLayout.none, LabelLayout.float, LabelLayout.placeholder].includes(labelLayout)) {
      return (
        <div className={`${prefixCls}-wrapper`}>
          {cloneElement<FormFieldProps>(child, fieldElementProps)}
        </div>
      );
    }
    const label = getProperty(fieldProps, 'label', dataSet, record);
    const required = getPropertyDSFirst(fieldProps, 'required', dataSet, record);
    const readOnly = getProperty(fieldProps, 'readOnly', dataSet, record);
    const help = getProperty(fieldProps, 'help', dataSet, record);
    const fieldLabelWordBreak = getProperty(fieldProps, 'labelWordBreak', dataSet, record);
    const labelWordBreak = !isNil(fieldLabelWordBreak) ? fieldLabelWordBreak : contextLabelWordBreak;
    const isLabelShowHelp = (fieldElementProps.showHelp || showHelp || getConfig('showHelp')) === ShowHelp.label;
    const isOutput = labelLayout === LabelLayout.horizontal && ((child.type as any).displayName === 'Output' || intlFieldOutput);
    const labelClassName = classNames(`${prefixCls}-label`, `${prefixCls}-label-grid`, `${prefixCls}-label-${labelAlign}`, fieldClassName, {
      [`${prefixCls}-required`]: required && !((child.type as any).displayName === 'Output' || intlFieldOutput),
      [`${prefixCls}-readonly`]: readOnly,
      [`${prefixCls}-label-vertical`]: labelLayout === LabelLayout.vertical,
      [`${prefixCls}-label-output`]: isOutput,
      [`${prefixCls}-label-useColon`]: label && fieldUseColon,
      [`${prefixCls}-label-required-mark-${getRequiredMarkAlign(fieldRequiredMarkAlign)}`]: labelLayout === LabelLayout.horizontal && required && !((child.type as any).displayName === 'Output' || intlFieldOutput) && getRequiredMarkAlign(fieldRequiredMarkAlign),
      [`${prefixCls}-label-help`]: isLabelShowHelp,
      [`${prefixCls}-label-word-break`]: labelWordBreak,
    });
    const wrapperClassName = classNames(`${prefixCls}-wrapper`, {
      [`${prefixCls}-output`]: isOutput,
    });
    const tooltip = props.labelTooltip || labelTooltip;
    const helpWrap = isLabelShowHelp ? <LabelHelp help={help} /> : undefined;
    if (labelLayout === LabelLayout.vertical) {
      return (
        <>
          <Label className={labelClassName} tooltip={tooltip} help={helpWrap} labelWordBreak={labelWordBreak}>{label}</Label>
          <div className={wrapperClassName}>{cloneElement(child, fieldElementProps)}</div>
        </>
      );
    }
    const fieldLabelWidth = getProperty(fieldProps, 'labelWidth', dataSet, record);
    const columnLabelWidth = normalizeLabelWidth(contextLabelWidth, 1)[0];
    const labelWidth = columnLabelWidth === 'auto' ? undefined : Math.max(columnLabelWidth, isNaN(fieldLabelWidth) ? 0 : fieldLabelWidth);
    return (
      <Row className={`${prefixCls}-row`}>
        <Col className={`${prefixCls}-col`}>
          <Label className={labelClassName} width={labelWidth} tooltip={tooltip} help={helpWrap} labelWordBreak={labelWordBreak}><span>{label}</span></Label>
        </Col>
        <Col className={`${prefixCls}-col ${prefixCls}-col-control`}>
          <div className={wrapperClassName}>{cloneElement(child, fieldElementProps)}</div>
        </Col>
      </Row>
    );
  }
  if (child) {
    return child;
  }
  return null;
});

Item.displayName = 'FormItem';

Item.__PRO_FORM_ITEM = true;

export default Item;
