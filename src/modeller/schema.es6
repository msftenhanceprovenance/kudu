import _ from 'lodash';

export default {

  // Validate an object against a schema. Returns the same object after adding
  // any required default property values.
  validate( data, schema ) {

    // If we don't have a schema to validate against, or any data to validate,
    // we can't go any further.
    if ( typeof data !== 'object' || typeof schema !== 'object' ) {
      throw new Error('Missing schema.');
    }

    // A schema must contain a 'properties' object. This object dictates the
    // property names and value types that must be present on instances derived
    // from this schema.
    if ( typeof schema.properties !== 'object' ) {
      throw new Error('A model schema must include a "properties" object.');
    }

    // Enumerate the keys of the 'properties' object. Each value dictates how
    // its key should be validated on the 'data' object.
    let properties = schema.properties;
    Object.keys(properties).forEach(( key ) => {

      let sub = properties[ key ];

      // If a property is 'required' it must be present on the data object. The
      // value of 'required' must be a boolean value.
      if ( sub.required === true && !data.hasOwnProperty(key) ) {
        throw new Error(`Property "${ key }" is required.`);
      }

      let val = data[ key ];

      // If a property has a 'default' and the data object does not include
      // that property (or includes it with the value of null or undefined) we
      // add it with the default value.
      if ( sub.hasOwnProperty('default') && val == null ) {
        val = data[ key ] = sub.default;
      }

      // If a property has a 'type' and the data object includes that property,
      // the value must be of the correct type. The 'type' property in the
      // schema should be a native constructor.
      if ( sub.hasOwnProperty('type') && val != null ) {

        try {
          this[ `validate${ sub.type.name }`](val, sub);
        } catch ( err ) {
          throw new Error(`Property "${ key }": ${ err.message }`);
        }
      }
    });

    return data;
  },

  validateString( value ) {
    return this.validateType(value, 'string');
  },

  validateNumber( value ) {
    return this.validateType(value, 'number');
  },

  validateBoolean( value ) {
    return this.validateType(value, 'boolean');
  },

  validateDate( value ) {

    let type = Object.prototype.toString.call(value);
    let date = type === '[object Date]' ? value : new Date(value);

    if ( isNaN(date.valueOf()) ) {
      throw new Error('Value is not of type date.');
    }

    return true;
  },

  validateType( value, type ) {

    // Get the native type constructor. If we can't find one then assume we are
    // attempting to validate an unknown type.
    let Type = global[ _.capitalize(type) ];

    if ( typeof Type !== 'function' ) {
      throw new Error('Unknown type.');
    }

    // Validate type. Accepts literal values and boxed instances.
    if ( typeof value !== type && !(value instanceof Type) ) {
      throw new Error(`Value is not of type ${ type }.`);
    }

    return true;
  },
};
