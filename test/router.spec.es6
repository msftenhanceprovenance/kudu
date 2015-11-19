import chai from 'chai';
import supertest from 'supertest';

// Because Kudu is designed to work with Express we use a real Express instance
// in the routing tests, rather than attempting to mock all of the required
// Express functionality.
import express from 'express';
import { json } from 'body-parser';
import Kudu from '../src/kudu';
import Router from '../src/router';

let expect = chai.expect;
let expressApp;
let request;
let Model;
let Child;
let app;

describe('Router', () => {

  beforeEach(() => {
    expressApp = express();
    expressApp.use(json());
    app = new Kudu(expressApp);
    Model = app.createModel('test', {
      properties: {
        name: {
          type: String,
          required: true,
        },
        another: {
          type: String,
        },
      },
      relationships: {
        children: { type: 'child', key: 'parent', hasMany: true },
        unmodelled: { type: 'unmodelled', hasMany: true },
        unrequestable: { type: 'unrequestable', key: 'unrequestable' },
      },
    });
    Child = app.createModel('child', {
      properties: {
        name: {
          type: String,
          required: true,
        },
      },
    });
    app.createModel('unrequestable', {
      requestable: false,
      properties: {},
      relationships: {
        children: { type: 'child', key: 'parent', hasMany: true },
      },
    });
    let Shadow = app.createModel('shadow', {
      properties: {
        name: {
          type: String,
        },
      },
    });
    expressApp.post('/shadows', ( req, res, next ) => {
      req.instance = new Shadow({
        name: 'shadowed',
      });
      next();
    });
    app.createGenericRoutes();
    request = supertest(expressApp);
  });

  describe('generic POST handler', () => {

    it('should 404 when the URL does not correspond to a model', ( done ) => {
      request.post('/fail').send().expect(404, done);
    });

    it('should 404 when the model is unrequestable', ( done ) => {
      request.post('/unrequestables').send().expect(404, done);
    });

    it('should 400 when the request body is an invalid model', ( done ) => {
      request.post('/tests').send().expect(400, done);
    });

    it('should 409 when the request body type doesn\'t match the URL', ( done ) => {
      request.post('/tests').send({
        data: { type: 'fail' },
      }).expect(409, done);
    });

    it('should respond with a serialized object containing errors', ( done ) => {
      request.post('/tests').send().expect(400)
      .end(( err, res ) => {
        expect(res.body).to.have.property('errors').which.is.an('array');
        done();
      });
    });

    it('should 201 with the serialized instance when the body is valid', ( done ) => {
      request.post('/tests').send({
        data: { type: 'test', attributes: { name: 'test' } },
      }).expect(201)
      .end(( err, res ) => {
        if ( err ) {
          return done(err);
        }
        expect(res.body.data.attributes).to.have.property('name', 'test');
        done();
      });
    });

    it('should allow prior route handlers to deserialize the instance', ( done ) => {
      request.post('/shadows').send().expect(201)
      .end(( err, res ) => {
        if ( err ) {
          return done(err);
        }
        expect(res.body.data.attributes).to.have.property('name', 'shadowed');
        done();
      });
    });
  });

  describe('generic GET handler', () => {

    it('should 404 when the URL does not correspond to a model', ( done ) => {
      request.get('/fail').send().expect(404, done);
    });

    it('should 404 when the model is unrequestable', ( done ) => {
      request.get('/unrequestables').send().expect(404, done);
    });

    it('should 404 when the identifier does not correspond to a model', ( done ) => {
      request.get('/tests/1').send().expect(404, done);
    });

    it('should 200 with the serialized model instance when a valid identifier is present', ( done ) => {
      new Model({ id: '1', name: 'test' }).save()
      .then(() => {
        request.get('/tests/1').send().expect(200)
        .end(( err, res ) => {
          if ( err ) {
            throw err;
          }
          expect(res.body.data.attributes).to.have.property('name', 'test');
          done();
        });
      })
      .catch(( err ) => done(err));
    });

    it('should 200 with a serialized array of model instances when no identifier is present', ( done ) => {
      new Model({ id: '1', name: 'test' }).save()
      .then(() => {
        request.get('/tests').send().expect(200)
        .end(( err, res ) => {
          if ( err ) {
            throw err;
          }
          expect(res.body.data).to.be.an('array').and.to.have.length(1);
          done();
        });
      })
      .catch(( err ) => done(err));
    });

    it('should 200 with an empty array when no identifier is present and no models exist', ( done ) => {
      request.get('/tests').send().expect(200)
      .end(( err, res ) => {
        if ( err ) {
          throw err;
        }
        expect(res.body.data).to.be.an('array').and.to.have.length(0);
        done();
      });
    });
  });

  describe('generic descendant GET handler', () => {

    it('should 404 when the ancestor does not correspond to a model', ( done ) => {
      request.get('/fails/1/children').send().expect(404, done);
    });

    it('should 404 when the descendant is not related to the ancestor', ( done ) => {
      request.get('/tests/1/fails').send().expect(404, done);
    });

    it('should 404 when the descendant does not correspond to a model', ( done ) => {
      request.get('/tests/1/unmodelled').send().expect(404, done);
    });

    it('should 404 when the ancestor is unrequestable', ( done ) => {
      request.get('/unrequestables/1/children').send().expect(404, done);
    });

    it('should 404 when the descendant is unrequestable', ( done ) => {
      new Model({ id: '1', name: 'test' }).save()
      .then(() => {
        request.get('/tests/1/unrequestable').send().expect(404, done);
      });
    });

    it('should 200 with the response', ( done ) => {
      Promise.all([
        new Model({ id: '1', name: 'test' }).save(),
        new Child({ id: '2', name: 'child', parent: '1' }).save(),
        new Child({ id: '3', name: 'child', parent: '1' }).save(),
      ])
      .then(() => {

        request.get('/tests/1/children').send().expect(200)
        .end(( err, res ) => {
          if ( err ) {
            throw err;
          }
          expect(res.body.data).to.be.an('array');
          done();
        });
      });
    });
  });

  describe('generic PATCH handler', () => {

    it('should 404 when the URL does not correspond to a model', ( done ) => {
      request.patch('/fail').send().expect(404, done);
    });

    it('should 404 when the model is unrequestable', ( done ) => {
      request.patch('/unrequestables').send().expect(404, done);
    });

    it('should 404 when the identifier does not correspond to a model', ( done ) => {
      request.patch('/tests/1').send({
        data: { type: 'test', id: '1' },
      }).expect(404, done);
    });

    it('should 409 when the request body type doesn\'t match the URL', ( done ) => {
      request.patch('/tests/1').send({
        data: { type: 'fail', id: '1' },
      }).expect(409, done);
    });

    it('should 200 with an updated model instance', ( done ) => {
      new Model({ id: '1', name: 'test' }).save()
      .then(() => {
        request.patch('/tests/1').send({
          data: { type: 'test', id: '1', attributes: { name: 'new' } },
        }).expect(200)
        .end(( err, res ) => {
          if ( err ) {
            throw err;
          }
          expect(res.body.data.attributes).to.have.property('name', 'new');
          done();
        });
      })
      .catch(( err ) => done(err));
    });

    it('should not modify attributes not present in the request', ( done ) => {
      new Model({ id: '1', name: 'test', another: 'test' }).save()
      .then(() => {
        request.patch('/tests/1').send({
          data: { type: 'test', id: '1', attributes: { name: 'new' } },
        }).expect(200)
        .end(( err, res ) => {
          if ( err ) {
            throw err;
          }
          expect(res.body.data.attributes).to.have.property('another', 'test');
          done();
        });
      })
      .catch(( err ) => done(err));
    });
  });

  describe('generic DELETE handler', () => {

    it('should 404 when the URL does not correspond to a model', ( done ) => {
      request.delete('/fail').send().expect(404, done);
    });

    it('should 404 when the model is unrequestable', ( done ) => {
      request.delete('/unrequestables').send().expect(404, done);
    });

    it('should 404 when the identifier does not correspond to a model', ( done ) => {
      request.delete('/tests/1').send().expect(404, done);
    });

    it('should 204 on success', ( done ) => {
      new Model({ id: '1', name: 'test' }).save()
      .then(() => {
        request.delete('/tests/1').send().expect(204, done);
      })
      .catch(( err ) => done(err));
    });
  });

  describe('#handle', () => {

    it('should ignore the base path when given the relevant option', ( done ) => {

      let expressApp = express();
      let app = new Kudu(expressApp, {
        router: {
          baseURL: '/api',
        },
      });
      let request = supertest(expressApp);

      app.router.handle('GET', '/handle', {
        prependBaseURL: false,
      }, ( req, res ) => res.status(200).end());

      request.get('/handle')
      .expect(200, done);
    });
  });
});
